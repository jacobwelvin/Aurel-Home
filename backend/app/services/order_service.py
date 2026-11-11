import uuid
import random
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.orm import Session, joinedload, selectinload
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem, OrderHistory
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderStatusUpdate, OrderCreate

logger = logging.getLogger(__name__)

# Permitted state transition map
# Placed -> Confirmed, Processing, Cancelled
# Confirmed -> Processing, Cancelled
# Processing -> Shipped, Cancelled
# Shipped -> Delivered, Cancelled
# Delivered -> Terminal (No arbitrary regression)
# Cancelled -> Terminal (Restocked, immutable)
VALID_TRANSITIONS = {
    "Placed": {"Confirmed", "Processing", "Cancelled"},
    "Confirmed": {"Processing", "Cancelled"},
    "Processing": {"Shipped", "Cancelled"},
    "Shipped": {"Delivered", "Cancelled"},
    "Delivered": set(),  # Terminal state
    "Cancelled": set(),  # Terminal state
}


class OrderService:
    @staticmethod
    def list_orders(
        db: Session,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        payment_status_filter: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort: Optional[str] = "newest",
    ) -> Tuple[List[Order], int, int]:
        """
        List paginated orders with dynamic filtering and customer eagerly loaded.
        """
        stmt = (
            select(Order)
            .options(
                joinedload(Order.user),
                selectinload(Order.items).joinedload(OrderItem.product),
                selectinload(Order.history),
            )
        )

        # Filters
        if status_filter:
            stmt = stmt.where(func.lower(Order.status) == status_filter.lower())

        if payment_status_filter:
            stmt = stmt.where(func.lower(Order.payment_status) == payment_status_filter.lower())

        if search:
            search_term = f"%{search.strip().lower()}%"
            # Join user for search if needed
            stmt = stmt.outerjoin(Order.user).where(
                or_(
                    func.lower(Order.order_number).like(search_term),
                    func.lower(Order.tracking_number).like(search_term),
                    func.lower(User.email).like(search_term),
                    func.lower(User.name).like(search_term),
                    func.lower(cast(Order.shipping_address, String)).like(search_term),
                )
            )

        if start_date:
            stmt = stmt.where(Order.created_at >= start_date)

        if end_date:
            stmt = stmt.where(Order.created_at <= end_date)

        # Fast direct count of distinct orders matching filter conditions
        count_stmt = select(func.count(Order.id))
        if status_filter:
            count_stmt = count_stmt.where(func.lower(Order.status) == status_filter.lower())
        if payment_status_filter:
            count_stmt = count_stmt.where(func.lower(Order.payment_status) == payment_status_filter.lower())
        if search:
            search_term = f"%{search.strip().lower()}%"
            count_stmt = count_stmt.outerjoin(Order.user).where(
                or_(
                    func.lower(Order.order_number).like(search_term),
                    func.lower(Order.tracking_number).like(search_term),
                    func.lower(User.email).like(search_term),
                    func.lower(User.name).like(search_term),
                    func.lower(cast(Order.shipping_address, String)).like(search_term),
                )
            )
        if start_date:
            count_stmt = count_stmt.where(Order.created_at >= start_date)
        if end_date:
            count_stmt = count_stmt.where(Order.created_at <= end_date)

        total = db.scalar(count_stmt) or 0

        # Sorting
        if sort == "oldest":
            stmt = stmt.order_by(Order.created_at.asc())
        elif sort == "total-desc":
            stmt = stmt.order_by(Order.total_amount.desc())
        elif sort == "total-asc":
            stmt = stmt.order_by(Order.total_amount.asc())
        else:  # newest
            stmt = stmt.order_by(Order.created_at.desc())

        # Pagination
        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)

        orders = db.scalars(stmt).all()
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return orders, total, pages

    @staticmethod
    def get_by_id(db: Session, order_id: uuid.UUID) -> Order:
        """Fetch order with full customer, items, and history relationships."""
        stmt = (
            select(Order)
            .options(
                joinedload(Order.user),
                joinedload(Order.items).joinedload(OrderItem.product),
                joinedload(Order.history),
            )
            .where(Order.id == order_id)
        )
        order = db.scalars(stmt).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID '{order_id}' was not found.",
            )
        return order

    @staticmethod
    def create_order(
        db: Session,
        order_in: OrderCreate,
        current_user: Optional[User] = None,
        idempotency_key: Optional[str] = None,
    ) -> Order:
        """
        Atomically validate cart items, enforce server-authoritative product pricing,
        check & decrement inventory stock, deduplicate using idempotency key,
        persist Order and OrderItems, and record initial OrderHistory audit trail.
        """
        if not order_in.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order must contain at least one consignment item.",
            )

        # Check idempotency key if provided to prevent duplicate orders
        effective_idempotency_key = (idempotency_key or order_in.idempotency_key or "").strip() or None
        if effective_idempotency_key:
            stmt = (
                select(Order)
                .options(
                    joinedload(Order.user),
                    joinedload(Order.items).joinedload(OrderItem.product),
                    joinedload(Order.history),
                )
                .where(Order.idempotency_key == effective_idempotency_key)
            )
            existing_order = db.scalars(stmt).first()
            if existing_order:
                logger.info(f"Idempotent order request matched existing order: {existing_order.order_number}")
                return existing_order

        order_items_data = []
        calculated_subtotal = Decimal("0.00")

        # Validate products and prices authoritatively against PostgreSQL database
        for item_in in order_in.items:
            product = None
            if item_in.product_id:
                try:
                    product = db.query(Product).filter(Product.id == item_in.product_id).with_for_update().first()
                except Exception:
                    product = None
            if not product and item_in.slug:
                product = db.query(Product).filter(Product.slug == item_in.slug).with_for_update().first()

            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{item_in.product_name}' was not found in catalog.",
                )

            if product.stock <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"'{product.name}' is currently out of stock.",
                )

            if product.stock < item_in.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient inventory for '{product.name}'. Available: {product.stock}, requested: {item_in.quantity}.",
                )

            # Deduct inventory atomically
            product.stock -= item_in.quantity
            # Server-authoritative pricing: ALWAYS compute from product.price in DB
            unit_price = Decimal(str(product.price))
            product_name = product.name
            product_id = product.id

            line_total = (unit_price * item_in.quantity).quantize(Decimal("0.01"))
            calculated_subtotal += line_total

            order_items_data.append({
                "product_id": product_id,
                "product_name_snapshot": product_name,
                "quantity": item_in.quantity,
                "unit_price": unit_price,
                "line_total": line_total,
            })

        # Calculate shipping amount
        if order_in.delivery_method == "whiteglove":
            shipping_amount = Decimal("499.00")
        elif calculated_subtotal >= Decimal("2999.00"):
            shipping_amount = Decimal("0.00")
        else:
            shipping_amount = Decimal("450.00")

        total_amount = (calculated_subtotal + shipping_amount).quantize(Decimal("0.01"))

        # Generate unique order number (e.g. AUR-8921-IN)
        while True:
            rand_code = random.randint(1000, 9999)
            order_number = f"AUR-{rand_code}-IN"
            existing = db.query(Order).filter(Order.order_number == order_number).first()
            if not existing:
                break

        # Set payment and fulfillment status
        pm_lower = (order_in.payment_method or "upi").lower()
        if order_in.payment_status:
            payment_status = order_in.payment_status.strip().capitalize()
            order_status = "Confirmed" if payment_status.lower() == "paid" else "Placed"
        elif order_in.payment_reference:
            payment_status = "Paid"
            order_status = "Confirmed"
        elif pm_lower in ["upi", "card", "netbanking"]:
            payment_status = "Paid"
            order_status = "Confirmed"
        else:
            payment_status = "Pending"
            order_status = "Placed"

        # Determine user_id
        user_id = current_user.id if current_user else None
        if not user_id and order_in.shipping_address and "email" in order_in.shipping_address:
            guest_email = str(order_in.shipping_address["email"]).strip().lower()
            matching_user = db.query(User).filter(func.lower(User.email) == guest_email).first()
            if matching_user:
                user_id = matching_user.id

        try:
            order = Order(
                order_number=order_number,
                idempotency_key=effective_idempotency_key,
                user_id=user_id,
                status=order_status,
                payment_status=payment_status,
                subtotal=calculated_subtotal,
                shipping_amount=shipping_amount,
                total_amount=total_amount,
                shipping_address=order_in.shipping_address,
                payment_method=order_in.payment_method,
                original_payment_method=order_in.payment_method,
                payment_reference=order_in.payment_reference,
                paid_at=datetime.now(timezone.utc) if payment_status.lower() == "paid" else None,
            )
            db.add(order)
            db.flush()

            for item_data in order_items_data:
                order_item = OrderItem(
                    order_id=order.id,
                    product_id=item_data["product_id"],
                    product_name_snapshot=item_data["product_name_snapshot"],
                    quantity=item_data["quantity"],
                    unit_price=item_data["unit_price"],
                    line_total=item_data["line_total"],
                )
                db.add(order_item)

            history_entry = OrderHistory(
                order_id=order.id,
                previous_status=None,
                new_status=order_status,
                action_by=current_user.email if current_user else (order_in.shipping_address.get("email") or "Customer Checkout"),
                note=f"Order placed via {order_in.payment_method.upper()} protocol",
            )
            db.add(history_entry)

            db.commit()
            db.refresh(order)
            return OrderService.get_by_id(db, order.id)
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to persist order transaction: {exc}", exc_info=True)
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction failed while persisting order to database. The order was not processed.",
            ) from exc

    @staticmethod
    def list_customer_orders(db: Session, user: User) -> List[Order]:
        """
        List all orders associated with the authenticated user:
        either via user_id or matching shipping email.
        """
        stmt = (
            select(Order)
            .options(
                joinedload(Order.user),
                joinedload(Order.items).joinedload(OrderItem.product),
                joinedload(Order.history),
            )
            .where(
                or_(
                    Order.user_id == user.id,
                    func.lower(Order.shipping_address["email"].as_string()) == user.email.lower(),
                )
            )
            .order_by(Order.created_at.desc())
        )
        return db.scalars(stmt).unique().all()

    @staticmethod
    def get_customer_order(
        db: Session,
        identifier: str,
        user: Optional[User] = None,
        email: Optional[str] = None,
    ) -> Order:
        """
        Fetch order by UUID or order_number with security checks:
        - Admin can view any order.
        - Authenticated customer can view only their own orders.
        - Guest can view if provided email matches shipping address email.
        """
        stmt = (
            select(Order)
            .options(
                joinedload(Order.user),
                joinedload(Order.items).joinedload(OrderItem.product),
                joinedload(Order.history),
            )
        )
        try:
            val_uuid = uuid.UUID(identifier)
            stmt = stmt.where(or_(Order.id == val_uuid, Order.order_number == identifier))
        except ValueError:
            stmt = stmt.where(Order.order_number == identifier)

        order = db.scalars(stmt).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with identifier '{identifier}' was not found.",
            )

        # Authorization check
        if user and user.role == "admin":
            return order

        order_email = (order.shipping_address.get("email") if order.shipping_address else "") or ""
        order_user_id = str(order.user_id) if order.user_id else None

        if user:
            if order_user_id == str(user.id) or order_email.lower() == user.email.lower():
                return order
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to access this consignment.",
            )

        if email and order_email.lower() == email.strip().lower():
            return order

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Verification email required to view guest consignment details.",
        )

    @staticmethod
    def update_order_status(
        db: Session,
        order_id: uuid.UUID,
        update_in: OrderStatusUpdate,
        action_by: str = "Admin",
    ) -> Order:
        """
        Validate lifecycle status transition and execute inside an atomic transaction.
        If moving to Cancelled: restores inventory stock for each line item safely
        (idempotently, preventing double-restock).
        """
        order = OrderService.get_by_id(db, order_id)

        current_status = order.status
        target_status = update_in.new_status.strip().capitalize()
        # Handle variations like "whiteglove", "Cancelled", "Processing"
        status_map = {
            "placed": "Placed",
            "confirmed": "Confirmed",
            "processing": "Processing",
            "shipped": "Shipped",
            "delivered": "Delivered",
            "cancelled": "Cancelled",
            "canceled": "Cancelled",
        }
        normalized_target = status_map.get(target_status.lower(), target_status)

        # 1. Reject duplicate status update
        if current_status == normalized_target:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order is already in '{current_status}' status.",
            )

        # 2. Prevent invalid transitions
        allowed = VALID_TRANSITIONS.get(current_status, set())
        if normalized_target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status transition from '{current_status}' to '{normalized_target}'. "
                    f"Allowed target states: {list(allowed) if allowed else 'None (Terminal state)'}."
                ),
            )

        # 3. Handle stock restoration on cancellation
        if normalized_target == "Cancelled":
            # Only restore stock if not already cancelled and items exist
            for item in order.items:
                if item.product_id:
                    prod = db.get(Product, item.product_id)
                    if prod:
                        prod.stock += item.quantity

        # 4. Update order details
        order.status = normalized_target
        if update_in.carrier:
            order.carrier = update_in.carrier.strip()
        if update_in.tracking_number:
            order.tracking_number = update_in.tracking_number.strip()

        # 5. Create audit history log
        history_entry = OrderHistory(
            order_id=order.id,
            previous_status=current_status,
            new_status=normalized_target,
            action_by=action_by,
            note=update_in.note,
        )
        db.add(history_entry)

        db.commit()
        db.refresh(order)
        return OrderService.get_by_id(db, order.id)
