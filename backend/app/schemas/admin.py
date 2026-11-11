import uuid
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DashboardStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_orders: int = Field(..., description="Total count of patron orders")
    total_revenue: float = Field(..., description="Aggregated revenue across all orders")
    total_active_products: int = Field(..., description="Total count of active catalog products")
    low_stock_products: int = Field(..., description="Count of active products with stock <= threshold")
    low_stock_threshold: int = Field(default=5, description="Inventory threshold defining low stock")
    total_categories: int = Field(..., description="Total count of active product categories")
    total_customers: int = Field(..., description="Total count of registered customer patrons")


class RecentOrderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_number: str
    status: str
    total_amount: float
    subtotal: float
    shipping_amount: float
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    recipient_name: Optional[str] = None
    account_name: Optional[str] = None
    created_at: datetime
    items_count: int = 0


class SalesSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_revenue: float
    orders_count: int
    average_order_value: float
    status_breakdown: Dict[str, int]
    has_data: bool
