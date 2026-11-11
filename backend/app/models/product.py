import uuid
from sqlalchemy import Column, String, Text, Numeric, Integer, Boolean, ForeignKey, JSON, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    """
    Product model for Aurel Home atelier catalog items.
    """
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="check_product_price_non_negative"),
        CheckConstraint("stock >= 0", name="check_product_stock_non_negative"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    subtitle = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    # Financial / Inventory integrity
    price = Column(Numeric(10, 2), nullable=False)
    compare_at_price = Column(Numeric(10, 2), nullable=True)
    stock = Column(Integer, default=0, nullable=False)

    # Product specs and media
    images = Column(JSON, default=list, nullable=False)
    details = Column(JSON, default=list, nullable=True)
    materials = Column(Text, nullable=True)
    dimensions = Column(String(255), nullable=True)
    care = Column(Text, nullable=True)
    badge = Column(String(50), nullable=True)
    colors = Column(JSON, default=list, nullable=True)

    # Social proof & editorial markers
    rating = Column(Numeric(3, 2), default=5.00, nullable=False)
    review_count = Column(Integer, default=0, nullable=False)
    featured = Column(Boolean, default=False, nullable=False)
    bestseller = Column(Boolean, default=False, nullable=False)

    # Category association
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Lifecycle status
    active = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    category = relationship("Category", back_populates="products")
    cart_items = relationship("CartItem", back_populates="product", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="product")

    def __repr__(self) -> str:
        return f"<Product id={self.id} slug={self.slug} price={self.price}>"
