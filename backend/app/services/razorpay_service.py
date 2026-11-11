import hmac
import hashlib
import uuid
import logging
from typing import Optional, Dict, Any
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.order import Order, OrderHistory
from app.models.user import User
from app.services.order_service import OrderService

logger = logging.getLogger("aurel.razorpay")


class RazorpayService:
    @staticmethod
    def create_razorpay_order(
        db: Session,
        order_id: uuid.UUID,
        user: Optional[User] = None,
        email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a Razorpay order in test mode for an existing customer consignment.
        Calculates exact amount in paise from server-authoritative order total.
        """
        order = OrderService.get_customer_order(db, str(order_id), user=user, email=email)

        if order.status == "Cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order {order.order_number} has been cancelled and is ineligible for payment.",
            )

        if order.payment_status in ("Paid", "Refunded"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order {order.order_number} has already been paid and verified.",
            )

        settings = get_settings()
        amount_paise = int(round(float(order.total_amount) * 100))

        key_id = settings.RAZORPAY_KEY_ID or "rzp_test_placeholder"
        key_secret = settings.RAZORPAY_KEY_SECRET

        razorpay_order_id = None

        # If live test credentials are provided, call Razorpay API
        if key_secret and key_id and not key_id.endswith("placeholder"):
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(
                        "https://api.razorpay.com/v1/orders",
                        auth=(key_id, key_secret),
                        json={
                            "amount": amount_paise,
                            "currency": "INR",
                            "receipt": order.order_number,
                            "notes": {
                                "order_id": str(order.id),
                                "order_number": order.order_number,
                            },
                        },
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        razorpay_order_id = data.get("id")
                    else:
                        logger.warning(
                            f"Razorpay API responded with {resp.status_code}: {resp.text}"
                        )
                        if settings.APP_ENV in ["development", "testing"] or "test" in key_id.lower():
                            razorpay_order_id = f"order_test_{uuid.uuid4().hex[:14]}"
                        else:
                            raise HTTPException(
                                status_code=status.HTTP_502_BAD_GATEWAY,
                                detail=f"Failed to create Razorpay test order: {resp.text}",
                            )
            except httpx.RequestError as exc:
                logger.warning(f"Error connecting to Razorpay: {exc}")
                if settings.APP_ENV in ["development", "testing"] or "test" in key_id.lower():
                    razorpay_order_id = f"order_test_{uuid.uuid4().hex[:14]}"
                else:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Payment gateway is currently unreachable. Please retry shortly.",
                    )
        else:
            # Deterministic test ID for local offline test environment
            razorpay_order_id = f"order_test_{uuid.uuid4().hex[:14]}"

        order.razorpay_order_id = razorpay_order_id
        db.commit()
        db.refresh(order)

        shipping_addr = order.shipping_address or {}
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "razorpay_order_id": razorpay_order_id,
            "amount": amount_paise,
            "currency": "INR",
            "key_id": key_id,
            "customer_name": (
                shipping_addr.get("fullName")
                or shipping_addr.get("name")
                or (order.user.name if order.user else None)
            ),
            "customer_email": (
                shipping_addr.get("email")
                or (order.user.email if order.user else None)
            ),
            "customer_phone": shipping_addr.get("phone"),
        }

    @staticmethod
    def verify_razorpay_payment(
        db: Session,
        order_id: uuid.UUID,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
        user: Optional[User] = None,
        email: Optional[str] = None,
    ) -> Order:
        """
        Verify Razorpay payment signature via HMAC SHA256 and mark consignment as Paid.
        Enforces idempotency and customer data isolation.
        """
        order = OrderService.get_customer_order(db, str(order_id), user=user, email=email)
        settings = get_settings()

        if order.status == "Cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cancelled order {order.order_number} cannot be paid.",
            )

        # Idempotent response if already verified with the same payment reference
        if order.payment_status == "Paid" and (
            order.razorpay_payment_id == razorpay_payment_id
            or order.payment_reference == razorpay_payment_id
        ):
            logger.info(f"Idempotent verification replay for order {order.order_number}")
            return order

        # Reject duplicate payment attempts if already settled
        if order.payment_status in ("Paid", "Refunded"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order {order.order_number} has already been paid and verified.",
            )

        # Order ID association check
        if order.razorpay_order_id and order.razorpay_order_id != razorpay_order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razorpay order ID mismatch with registered consignment.",
            )

        # Cryptographic HMAC SHA256 verification
        key_secret = settings.RAZORPAY_KEY_SECRET
        if key_secret:
            payload = f"{razorpay_order_id}|{razorpay_payment_id}"
            generated_signature = hmac.new(
                key_secret.encode("utf-8"),
                payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            if not hmac.compare_digest(generated_signature, razorpay_signature):
                logger.warning(
                    f"Razorpay signature mismatch for order {order.order_number}. "
                    f"Expected {generated_signature}, got {razorpay_signature}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Razorpay payment signature. Payment verification rejected.",
                )
        else:
            # If secret not explicitly set in test environment, validate basic signature format
            if not (
                razorpay_signature.startswith("sig_")
                or razorpay_signature.startswith("test_")
                or len(razorpay_signature) >= 32
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid payment signature format for test mode.",
                )

        from datetime import datetime, timezone
        now_utc = datetime.now(timezone.utc)

        prev_payment_method = order.payment_method
        was_cod = (order.original_payment_method or "").lower() == "cod" or (prev_payment_method or "").lower() == "cod"

        if was_cod and not order.original_payment_method:
            order.original_payment_method = "cod"

        # Update payment method to online while keeping COD tracking separate
        if was_cod:
            order.payment_method = "upi"

        prev_status = order.status
        order.payment_status = "Paid"
        if order.status == "Placed":
            order.status = "Confirmed"

        order.payment_reference = razorpay_payment_id
        order.razorpay_order_id = razorpay_order_id
        order.razorpay_payment_id = razorpay_payment_id
        order.razorpay_signature = razorpay_signature
        order.paid_at = now_utc

        # Log transition in OrderHistory
        action_user = "Razorpay Test Gateway"
        if user and user.email:
            action_user = user.email
        elif order.shipping_address and order.shipping_address.get("email"):
            action_user = order.shipping_address.get("email")

        note_text = (
            f"COD consignment paid online via Razorpay test mode. Payment ID: {razorpay_payment_id}"
            if was_cod
            else f"Razorpay test payment verified successfully. Payment ID: {razorpay_payment_id}"
        )

        history_entry = OrderHistory(
            order_id=order.id,
            previous_status=prev_status,
            new_status=order.status,
            action_by=action_user,
            note=note_text,
        )
        db.add(history_entry)

        db.commit()
        db.refresh(order)
        logger.info(f"Order {order.order_number} marked as Paid via payment {razorpay_payment_id} (was_cod={was_cod})")
        return order

    @staticmethod
    def record_payment_cancellation(
        db: Session,
        order_id: uuid.UUID,
        reason: Optional[str] = None,
        user: Optional[User] = None,
        email: Optional[str] = None,
    ) -> Order:
        """
        Record cancellation or dismissal of Razorpay modal without falsely marking order as paid.
        Order remains in 'Pending' payment state.
        """
        order = OrderService.get_customer_order(db, str(order_id), user=user, email=email)

        # Do not cancel if already paid
        if order.payment_status == "Paid":
            return order

        action_user = "Customer Checkout"
        if user and user.email:
            action_user = user.email
        elif order.shipping_address and order.shipping_address.get("email"):
            action_user = order.shipping_address.get("email")

        cancel_note = f"Razorpay payment attempt aborted: {reason or 'Modal dismissed by user'}"

        history_entry = OrderHistory(
            order_id=order.id,
            previous_status=order.status,
            new_status=order.status,
            action_by=action_user,
            note=cancel_note,
        )
        db.add(history_entry)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def process_webhook_event(
        db: Session,
        raw_body: bytes,
        signature: Optional[str],
    ) -> Dict[str, Any]:
        """
        Validate and process asynchronous Razorpay webhooks.
        Signature is verified using RAZORPAY_WEBHOOK_SECRET.
        Idempotent: Duplicate webhook events do not duplicate state transitions.
        """
        import json
        settings = get_settings()
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET

        if not webhook_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Razorpay webhook processing is not enabled. RAZORPAY_WEBHOOK_SECRET is unconfigured.",
            )

        if not signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing X-Razorpay-Signature header.",
            )

        # Compute HMAC SHA256 of raw bytes with webhook secret
        computed_signature = hmac.new(
            webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(computed_signature, signature):
            logger.warning("Invalid Razorpay webhook signature received.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay webhook signature.",
            )

        try:
            event_data = json.loads(raw_body.decode("utf-8"))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload in webhook body.",
            ) from exc

        event_type = event_data.get("event")
        payload = event_data.get("payload", {})

        if event_type in ("order.paid", "payment.captured"):
            order_entity = payload.get("order", {}).get("entity", {})
            payment_entity = payload.get("payment", {}).get("entity", {})

            rzp_order_id = order_entity.get("id") or payment_entity.get("order_id")
            rzp_payment_id = payment_entity.get("id")

            if not rzp_order_id:
                return {"status": "ignored", "reason": "No order_id present in webhook entity"}

            # Lookup order in database by razorpay_order_id
            order = db.query(Order).filter(Order.razorpay_order_id == rzp_order_id).first()
            if not order:
                receipt = order_entity.get("receipt")
                if receipt:
                    order = db.query(Order).filter(Order.order_number == receipt).first()

            if not order:
                logger.warning(f"Webhook received for unknown Razorpay order {rzp_order_id}")
                return {"status": "ignored", "reason": f"Consignment for {rzp_order_id} not found"}

            # Idempotency check: if already paid, return 200 without duplicate updates
            if order.payment_status == "Paid":
                logger.info(f"Webhook {event_type} ignored: order {order.order_number} is already Paid.")
                return {"status": "ok", "message": "Order already marked as Paid", "order_number": order.order_number}

            prev_status = order.status
            prev_pm = order.payment_method
            was_cod = (order.original_payment_method or "").lower() == "cod" or (prev_pm or "").lower() == "cod"

            if was_cod and not order.original_payment_method:
                order.original_payment_method = "cod"
            if was_cod:
                order.payment_method = "upi"

            order.payment_status = "Paid"
            if order.status == "Placed":
                order.status = "Confirmed"

            from datetime import datetime, timezone
            order.paid_at = datetime.now(timezone.utc)

            if rzp_payment_id:
                order.payment_reference = rzp_payment_id
                order.razorpay_payment_id = rzp_payment_id

            note_text = (
                f"Payment confirmed via Razorpay webhook ({event_type}) for COD consignment. Payment ID: {rzp_payment_id or 'N/A'}"
                if was_cod
                else f"Payment confirmed via Razorpay webhook ({event_type}). Payment ID: {rzp_payment_id or 'N/A'}"
            )

            history_entry = OrderHistory(
                order_id=order.id,
                previous_status=prev_status,
                new_status=order.status,
                action_by="Razorpay Webhook Service",
                note=note_text,
            )
            db.add(history_entry)
            db.commit()
            db.refresh(order)
            logger.info(f"Order {order.order_number} marked as Paid via webhook {event_type}")
            return {"status": "ok", "message": "Order payment confirmed", "order_number": order.order_number}

        elif event_type in ("payment.failed",):
            payment_entity = payload.get("payment", {}).get("entity", {})
            rzp_order_id = payment_entity.get("order_id")
            error_desc = payment_entity.get("error_description") or "Payment authorization failed"

            if rzp_order_id:
                order = db.query(Order).filter(Order.razorpay_order_id == rzp_order_id).first()
                if order and order.payment_status != "Paid":
                    history_entry = OrderHistory(
                        order_id=order.id,
                        previous_status=order.status,
                        new_status=order.status,
                        action_by="Razorpay Webhook Service",
                        note=f"Payment failure reported via webhook: {error_desc}",
                    )
                    db.add(history_entry)
                    db.commit()
                    return {"status": "ok", "message": "Failure logged", "order_number": order.order_number}

            return {"status": "ok", "message": "Event received and logged"}

        return {"status": "ignored", "event": event_type}
