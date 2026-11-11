from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.category import CategoryResponse


class ProductColorSchema(BaseModel):
    name: str
    hex: str
    image: Optional[str] = None


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Product title")
    slug: str = Field(..., min_length=1, max_length=255, description="URL-friendly unique slug")
    subtitle: Optional[str] = Field(None, max_length=255, description="Editorial subtitle/materials summary")
    description: Optional[str] = Field(None, description="Full narrative description")
    price: Decimal = Field(..., ge=0, description="Product price in main currency unit (e.g. INR/USD)")
    compare_at_price: Optional[Decimal] = Field(None, ge=0, description="Original strike-through price")
    stock: int = Field(0, ge=0, description="Available stock quantity")
    images: List[str] = Field(default_factory=list, description="Array of image URLs")
    details: Optional[List[str]] = Field(default_factory=list, description="List of craftsman bullet points")
    materials: Optional[str] = Field(None, description="Material composition")
    dimensions: Optional[str] = Field(None, description="Physical dimensions")
    care: Optional[str] = Field(None, description="Care instructions")
    badge: Optional[str] = Field(None, max_length=50, description="Badge tag (e.g. Bestseller, Limited)")
    colors: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Available color swatches")
    featured: bool = Field(False, description="Featured on homepage")
    bestseller: bool = Field(False, description="Highlighted as bestseller")
    category_id: Optional[UUID] = Field(None, description="Associated category ID")
    active: bool = Field(True, description="Whether product is active/visible in storefront")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0)
    compare_at_price: Optional[Decimal] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)
    images: Optional[List[str]] = None
    details: Optional[List[str]] = None
    materials: Optional[str] = None
    dimensions: Optional[str] = None
    care: Optional[str] = None
    badge: Optional[str] = None
    colors: Optional[List[Dict[str, Any]]] = None
    featured: Optional[bool] = None
    bestseller: Optional[bool] = None
    category_id: Optional[UUID] = None
    active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: UUID
    rating: Decimal = Field(default=Decimal("5.00"))
    review_count: int = Field(default=0)
    category: Optional[CategoryResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    limit: int
    pages: int


class StockAdjustment(BaseModel):
    stock: int = Field(..., ge=0, description="New non-negative absolute stock quantity")
    reason: Optional[str] = Field(None, max_length=255, description="Audit note/reason for stock adjustment")

