import uuid
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """
    User model structured for direct compatibility with future Supabase Auth integration.
    Uses UUID primary keys matching auth.users.
    Does not store plain passwords or custom auth credentials.
    """
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    name = Column(String(255), nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    role = Column(String(50), nullable=False, default="customer", server_default="customer", index=True)

    # Relationships
    carts = relationship("Cart", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
