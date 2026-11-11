import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin


class Cart(Base, TimestampMixin):
    """
    Shopping cart model associated with a customer account or guest session.
    """
    __tablename__ = "carts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Relationships
    user = relationship("User", back_populates="carts")
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Cart id={self.id} user_id={self.user_id}>"


class CartItem(Base, TimestampMixin):
    """
    Individual item line within a shopping cart.
    Enforces quantity > 0 through database check constraint.
    """
    __tablename__ = "cart_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_cart_item_quantity_positive"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    cart_id = Column(
        UUID(as_uuid=True),
        ForeignKey("carts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity = Column(Integer, default=1, nullable=False)
    selected_color = Column(String(100), nullable=True)
    selected_size = Column(String(50), nullable=True)

    # Relationships
    cart = relationship("Cart", back_populates="items")
    product = relationship("Product", back_populates="cart_items")

    def __repr__(self) -> str:
        return f"<CartItem id={self.id} cart_id={self.cart_id} product_id={self.product_id} qty={self.quantity}>"
