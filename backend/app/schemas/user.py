from uuid import UUID
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field

UserRole = Literal["customer", "admin"]


class UserBase(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Full patron name")
    email: str = Field(..., max_length=255, description="Unique email address")


class UserCreate(UserBase):
    id: UUID = Field(..., description="Supabase auth.users UUID")
    role: UserRole = Field("customer", description="User role, defaults strictly to customer")


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255, description="Updated display name")


class UserProfileSync(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Display name from Supabase user_metadata")


class UserResponse(BaseModel):
    id: UUID
    name: Optional[str] = None
    email: str
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
