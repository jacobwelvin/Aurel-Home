from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Category display title")
    slug: str = Field(..., min_length=1, max_length=255, description="URL-friendly unique slug")
    realm_number: Optional[str] = Field(None, max_length=50, description="Atelier realm label, e.g. Realm 01")
    description: Optional[str] = Field(None, description="Editorial description of the category")
    image: Optional[str] = Field(None, description="Featured cover image URL")
    active: bool = Field(True, description="Whether the category is visible in the storefront")


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255)
    realm_number: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    image: Optional[str] = None
    active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: UUID
    item_count: Optional[int] = Field(None, description="Number of active catalog products in this realm")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
