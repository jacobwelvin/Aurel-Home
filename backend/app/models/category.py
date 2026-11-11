import uuid
from sqlalchemy import Column, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin


class Category(Base, TimestampMixin):
    """
    Product categories representing Aurel Home design realms.
    """
    __tablename__ = "categories"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    realm_number = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    image = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    products = relationship("Product", back_populates="category")

    def __repr__(self) -> str:
        return f"<Category id={self.id} slug={self.slug} name={self.name}>"
