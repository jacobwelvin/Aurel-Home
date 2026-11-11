import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Header, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_admin, get_current_user, get_optional_current_user
from app.models.user import User
from app.schemas.order import (
    OrderListResponse,
    OrderDetailResponse,
    OrderItemResponse,
    OrderHistoryResponse,
    OrderStatusUpdate,
    OrderCreate,
    RazorpayOrderCreateResponse,
    RazorpayPaymentVerifyRequest,
    RazorpayPaymentVerifyResponse,
    RazorpayPaymentCancelRequest,
    InvoiceResponse,
)
from app.services.order_service import OrderService
from app.services.razorpay_service import RazorpayService
from app.services.invoice_service import InvoiceService

# Admin order management router
router = APIRouter(prefix="/admin/orders", tags=["Admin Orders"])

# Customer-facing order router
customer_router = APIRouter(prefix="/orders", tags=["Customer Orders"])


def _map_order_item(item) -> OrderItemResponse:
    img = None
    if item.product and item.product.images and len(item.product.images) > 0:
        img = item.product.images[0]
    return OrderItemResponse(
        id=item.id,
        product_id=item.product_id,
        product_name_snapshot=item.product_name_snapshot,
        product_image=img,
        quantity=item.quantity,
        unit_price=item.unit_price,
        line_total=item.line_total,
        created_at=item.created_at,
    )


def _map_order_response(o) -> OrderDetailResponse:
    """Helper to cleanly format order response with patron data and snapshots."""
    shipping = o.shipping_address if isinstance(o.shipping_address, dict) else {}
    recipient_name = shipping.get("fullName") or shipping.get("name") or None
    recipient_email = shipping.get("email") or None
    recipient_phone = shipping.get("phone") or None
    account_name = o.user.name if o.user else None
    account_email = o.user.email if o.user else None

    # Customer name for this specific order prioritizes the actual checkout recipient.
    # Fallback to account profile name or "Recipient details unavailable" for historical/empty records.
    display_name = recipient_name or account_name or "Recipient details unavailable"
    display_email = recipient_email or account_email or None

    return OrderDetailResponse(
        id=o.id,
        order_number=o.order_number,
        user_id=o.user_id,
        customer_name=display_name,
        customer_email=display_email,
        recipient_name=recipient_name,
        recipient_email=recipient_email,
        recipient_phone=recipient_phone,
        account_name=account_name,
        account_email=account_email,
        status=o.status,
        payment_status=o.payment_status,
        subtotal=o.subtotal,
        shipping_amount=o.shipping_amount,
        total_amount=o.total_amount,
        shipping_address=o.shipping_address,
        payment_method=o.payment_method,
        payment_reference=o.payment_reference,
        razorpay_order_id=getattr(o, "razorpay_order_id", None),
        razorpay_payment_id=getattr(o, "razorpay_payment_id", None),
        original_payment_method=getattr(o, "original_payment_method", None),
        invoice_number=getattr(o, "invoice_number", None),
        paid_at=getattr(o, "paid_at", None),
        idempotency_key=getattr(o, "idempotency_key", None),
        tracking_number=o.tracking_number,
        carrier=o.carrier,
        created_at=o.created_at,
        updated_at=o.updated_at,
        items=[_map_order_item(item) for item in (o.items or [])],
        history=[OrderHistoryResponse.model_validate(h) for h in (o.history or [])],
    )


# =========================================================================
# Customer Facing Endpoints (/api/v1/orders)
# =========================================================================

@customer_router.post(
    "",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new customer order (Checkout)",
    description="Validates cart items, decrements stock atomically, and creates the order and audit history.",
)
def create_customer_order(
    order_in: OrderCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    effective_key = idempotency_key or x_idempotency_key or order_in.idempotency_key
    order = OrderService.create_order(
        db=db,
        order_in=order_in,
        current_user=current_user,
        idempotency_key=effective_key,
    )
    return _map_order_response(order)


@customer_router.get(
    "/me",
    response_model=List[OrderDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List orders for the authenticated customer",
)
def list_my_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[OrderDetailResponse]:
    orders = OrderService.list_customer_orders(db=db, user=current_user)
    return [_map_order_response(o) for o in orders]


@customer_router.get(
    "/{order_identifier}",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get order details by order number or ID",
)
def get_customer_order_detail(
    order_identifier: str,
    email: Optional[str] = Query(None, description="Email for guest order verification"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    order = OrderService.get_customer_order(
        db=db,
        identifier=order_identifier,
        user=current_user,
        email=email,
    )
    return _map_order_response(order)


@customer_router.post(
    "/{order_id}/razorpay/create-order",
    response_model=RazorpayOrderCreateResponse,
    status_code=status.HTTP_200_OK,
    summary="Initialize Razorpay Test Mode Order",
    description="Calculates exact payable amount from server-authoritative consignment pricing and returns Razorpay order details.",
)
def create_razorpay_order_endpoint(
    order_id: uuid.UUID,
    email: Optional[str] = Query(None, description="Email for guest customer verification"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> RazorpayOrderCreateResponse:
    order_data = RazorpayService.create_razorpay_order(
        db=db,
        order_id=order_id,
        user=current_user,
        email=email,
    )
    return RazorpayOrderCreateResponse(**order_data)


@customer_router.post(
    "/razorpay/verify",
    response_model=RazorpayPaymentVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Razorpay Payment Signature (Test Mode)",
    description="Validates HMAC SHA256 payment signature, confirms consignment ownership, and transitions payment status to Paid.",
)
def verify_razorpay_payment_endpoint(
    verify_in: RazorpayPaymentVerifyRequest,
    email: Optional[str] = Query(None, description="Email for guest customer verification"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> RazorpayPaymentVerifyResponse:
    order = RazorpayService.verify_razorpay_payment(
        db=db,
        order_id=verify_in.order_id,
        razorpay_order_id=verify_in.razorpay_order_id,
        razorpay_payment_id=verify_in.razorpay_payment_id,
        razorpay_signature=verify_in.razorpay_signature,
        user=current_user,
        email=email,
    )
    return RazorpayPaymentVerifyResponse(
        success=True,
        message="Payment verified successfully. Consignment allocated with confirmed status.",
        order=_map_order_response(order),
    )


@customer_router.post(
    "/razorpay/cancel",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Record Razorpay Payment Dismissal / Cancellation",
    description="Records customer checkout dismissal or abort in audit trail without marking order as Paid.",
)
def cancel_razorpay_payment_endpoint(
    cancel_in: RazorpayPaymentCancelRequest,
    email: Optional[str] = Query(None, description="Email for guest customer verification"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    order = RazorpayService.record_payment_cancellation(
        db=db,
        order_id=cancel_in.order_id,
        reason=cancel_in.reason,
        user=current_user,
        email=email,
    )
    return _map_order_response(order)


@customer_router.get(
    "/{order_id}/invoice",
    response_model=InvoiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get customer order invoice details (Post-delivery)",
    description="Retrieve structured invoice data for a delivered order. Accessible only to the order owner and authorized administrators.",
)
def get_order_invoice_data(
    order_id: uuid.UUID,
    email: Optional[str] = Query(None, description="Email for guest customer verification"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    data = InvoiceService.get_invoice_data(
        db=db,
        order_id=order_id,
        user=current_user,
        email=email,
    )
    return InvoiceResponse(**data)


@customer_router.get(
    "/{order_id}/invoice/pdf",
    status_code=status.HTTP_200_OK,
    summary="Download customer order invoice as PDF (Post-delivery)",
    description="Generates and streams a formatted PDF tax invoice. Accessible only to the order owner and authorized administrators.",
)
def download_order_invoice_pdf(
    order_id: uuid.UUID,
    email: Optional[str] = Query(None, description="Email for guest customer verification"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> Response:
    data = InvoiceService.get_invoice_data(
        db=db,
        order_id=order_id,
        user=current_user,
        email=email,
    )
    pdf_bytes = InvoiceService.generate_invoice_pdf(data)
    filename = f"Invoice-{data['invoice_number']}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@customer_router.post(
    "/razorpay/webhook",
    status_code=status.HTTP_200_OK,
    summary="Razorpay Webhook Handler",
    description="Processes asynchronous Razorpay webhook events (order.paid, payment.failed). Validates X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET. When unconfigured, returns 503 without crashing.",
)
async def razorpay_webhook_endpoint(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    return RazorpayService.process_webhook_event(
        db=db,
        raw_body=raw_body,
        signature=x_razorpay_signature,
    )


# =========================================================================
# Admin Endpoints (/api/v1/admin/orders)
# =========================================================================


@router.get(
    "",
    response_model=OrderListResponse,
    status_code=status.HTTP_200_OK,
    summary="List orders with filters and pagination (Admin only)",
    description="Retrieve paginated customer orders with search, status filter, payment filter, and date ranges.",
)
def list_admin_orders(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by order number, tracking, customer name or email"),
    status: Optional[str] = Query(None, description="Filter by order lifecycle status"),
    payment_status: Optional[str] = Query(None, description="Filter by payment status: Pending, Paid, Refunded"),
    start_date: Optional[datetime] = Query(None, description="Filter orders placed on or after this timestamp"),
    end_date: Optional[datetime] = Query(None, description="Filter orders placed on or before this timestamp"),
    sort: Optional[str] = Query("newest", description="Sort order: newest, oldest, total-desc, total-asc"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrderListResponse:
    items, total, pages = OrderService.list_orders(
        db=db,
        page=page,
        limit=limit,
        search=search,
        status_filter=status,
        payment_status_filter=payment_status,
        start_date=start_date,
        end_date=end_date,
        sort=sort,
    )

    return OrderListResponse(
        items=[_map_order_response(o) for o in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get(
    "/{order_id}",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get order details (Admin only)",
    description="Retrieve complete order dossier including shipping address, financial snapshots, and audit trail.",
)
def get_admin_order(
    order_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    order = OrderService.get_by_id(db=db, order_id=order_id)
    return _map_order_response(order)


@router.patch(
    "/{order_id}/status",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update order fulfillment lifecycle status (Admin only)",
    description="Validates status transition, creates audit history, and manages stock restoration on cancellation.",
)
def update_order_status(
    order_id: uuid.UUID,
    status_in: OrderStatusUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    admin_identifier = current_admin.email or current_admin.name or "Admin"
    updated_order = OrderService.update_order_status(
        db=db,
        order_id=order_id,
        update_in=status_in,
        action_by=admin_identifier,
    )
    return _map_order_response(updated_order)


@router.get(
    "/{order_id}/invoice",
    response_model=InvoiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get order invoice details (Admin only)",
)
def get_admin_order_invoice_data(
    order_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    data = InvoiceService.get_invoice_data(
        db=db,
        order_id=order_id,
        user=current_admin,
    )
    return InvoiceResponse(**data)


@router.get(
    "/{order_id}/invoice/pdf",
    status_code=status.HTTP_200_OK,
    summary="Download order invoice as PDF (Admin only)",
)
def download_admin_order_invoice_pdf(
    order_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    data = InvoiceService.get_invoice_data(
        db=db,
        order_id=order_id,
        user=current_admin,
    )
    pdf_bytes = InvoiceService.generate_invoice_pdf(data)
    filename = f"Invoice-{data['invoice_number']}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
