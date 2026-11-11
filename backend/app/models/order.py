import uuid
from sqlalchemy import Column, String, Numeric, Integer, ForeignKey, JSON, CheckConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin


class Order(Base, TimestampMixin):
    """
    Customer order record with financial totals and delivery lifecycle status.
    """
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("subtotal >= 0", name="check_order_subtotal_non_negative"),
        CheckConstraint("shipping_amount >= 0", name="check_order_shipping_non_negative"),
        CheckConstraint("total_amount >= 0", name="check_order_total_non_negative"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    order_number = Column(String(64), unique=True, index=True, nullable=False)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status = Column(String(50), default="Placed", nullable=False, index=True)
    payment_status = Column(String(50), default="Pending", nullable=False, index=True)
    subtotal = Column(Numeric(10, 2), nullable=False)
    shipping_amount = Column(Numeric(10, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)

    shipping_address = Column(JSON, nullable=True)
    payment_method = Column(String(100), nullable=True)
    original_payment_method = Column(String(100), nullable=True)
    payment_reference = Column(String(255), nullable=True)
    razorpay_order_id = Column(String(100), index=True, nullable=True)
    razorpay_payment_id = Column(String(100), index=True, nullable=True)
    razorpay_signature = Column(String(255), nullable=True)
    invoice_number = Column(String(100), unique=True, index=True, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    carrier = Column(String(100), nullable=True)

    # Relationships
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    history = relationship("OrderHistory", back_populates="order", cascade="all, delete-orphan", order_by="OrderHistory.created_at.desc()")

    def __repr__(self) -> str:
        return f"<Order id={self.id} number={self.order_number} total={self.total_amount}>"


class OrderItem(Base, TimestampMixin):
    """
    Individual line item in an order with immutable historical snapshot
    of product name and pricing at time of purchase.
    """
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_order_item_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="check_order_item_unit_price_non_negative"),
        CheckConstraint("line_total >= 0", name="check_order_item_line_total_non_negative"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    product_name_snapshot = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_total = Column(Numeric(10, 2), nullable=False)

    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    def __repr__(self) -> str:
        return f"<OrderItem id={self.id} order_id={self.order_id} total={self.line_total}>"


class OrderHistory(Base, TimestampMixin):
    """
    Audit log record capturing lifecycle status transitions, administrative actor,
    and notes/waybill attachments.
    """
    __tablename__ = "order_history"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    action_by = Column(String(255), nullable=True)
    note = Column(String, nullable=True)

    # Relationships
    order = relationship("Order", back_populates="history")

    def __repr__(self) -> str:
        return f"<OrderHistory order={self.order_id} {self.previous_status}->{self.new_status}>"

