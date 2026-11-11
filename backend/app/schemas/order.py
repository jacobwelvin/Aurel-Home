import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: Optional[uuid.UUID] = None
    product_name_snapshot: str
    product_image: Optional[str] = None
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    created_at: datetime


class OrderItemCreate(BaseModel):
    product_id: Optional[uuid.UUID] = None
    slug: Optional[str] = None
    product_name: str
    quantity: int = Field(..., gt=0, description="Quantity must be greater than zero")
    unit_price: Decimal = Field(..., ge=0, description="Price at purchase time")
    selected_color: Optional[str] = None
    selected_size: Optional[str] = None


class OrderCreate(BaseModel):
    items: List[OrderItemCreate] = Field(..., min_length=1, description="Order line items")
    shipping_address: Dict[str, Any] = Field(..., description="Shipping contact and destination address")
    payment_method: str = Field("upi", description="Payment method: upi, card, netbanking, cod")
    payment_reference: Optional[str] = Field(None, description="External payment provider confirmation ID")
    payment_status: Optional[str] = Field(None, description="Initial payment status: Pending or Paid")
    delivery_method: Optional[str] = Field("standard", description="standard or whiteglove")
    idempotency_key: Optional[str] = Field(None, max_length=128, description="Client idempotency key for deduplicating orders")


class OrderHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    previous_status: Optional[str] = None
    new_status: str
    action_by: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime


class OrderDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_number: str
    user_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    account_name: Optional[str] = None
    account_email: Optional[str] = None
    status: str
    payment_status: str
    subtotal: Decimal
    shipping_amount: Decimal
    total_amount: Decimal
    shipping_address: Optional[Dict[str, Any]] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    original_payment_method: Optional[str] = None
    invoice_number: Optional[str] = None
    paid_at: Optional[datetime] = None
    idempotency_key: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse] = []
    history: List[OrderHistoryResponse] = []


class OrderListResponse(BaseModel):
    items: List[OrderDetailResponse]
    total: int
    page: int
    limit: int
    pages: int


class OrderStatusUpdate(BaseModel):
    new_status: str = Field(..., description="Target status: Placed, Confirmed, Processing, Shipped, Delivered, Cancelled")
    carrier: Optional[str] = Field(None, max_length=100, description="Shipping carrier name (e.g. DTDC, BlueDart, Delhivery)")
    tracking_number: Optional[str] = Field(None, max_length=100, description="Waybill or consignment tracking number")
    note: Optional[str] = Field(None, description="Administrative audit note for the transition")


class RazorpayOrderCreateResponse(BaseModel):
    order_id: uuid.UUID
    order_number: str
    razorpay_order_id: str
    amount: int = Field(..., description="Amount in paise (INR cents)")
    currency: str = "INR"
    key_id: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None


class RazorpayPaymentVerifyRequest(BaseModel):
    order_id: uuid.UUID
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class RazorpayPaymentVerifyResponse(BaseModel):
    success: bool
    message: str
    order: OrderDetailResponse


class RazorpayPaymentCancelRequest(BaseModel):
    order_id: uuid.UUID
    reason: Optional[str] = Field("Customer cancelled payment or closed checkout window", description="Reason for cancellation")


class InvoiceBusinessDetails(BaseModel):
    name: str = "Aurel Home Atelier"
    legal_name: str = "Aurel Home Atelier Private Limited"
    gstin: str = "27AABCA1234F1Z8"
    address_line1: str
    address_line2: str
    contact: str
    website: str


class InvoiceRecipientDetails(BaseModel):
    full_name: str
    email: str
    phone: str
    address: str
    apartment: Optional[str] = None
    city: str
    state: str
    postal_code: str


class InvoiceItemDetail(BaseModel):
    product_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class InvoiceResponse(BaseModel):
    invoice_number: str
    order_id: uuid.UUID
    order_number: str
    invoice_date: str
    delivery_date: str
    status: str
    payment_status: str
    payment_status_display: str
    payment_method: Optional[str] = None
    payment_display: str
    original_payment_method: Optional[str] = None
    paid_online: bool
    payment_reference: Optional[str] = None
    paid_at: Optional[str] = None
    business: InvoiceBusinessDetails
    recipient: InvoiceRecipientDetails
    items: List[InvoiceItemDetail]
    subtotal: Decimal
    shipping_amount: Decimal
    discount: Decimal = Decimal("0.00")
    total_amount: Decimal

