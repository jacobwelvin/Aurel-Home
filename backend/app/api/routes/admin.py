from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.api.deps import require_admin
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.category import Category
from app.schemas.admin import (
    DashboardStatsResponse,
    RecentOrderSummary,
    SalesSummaryResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


@router.get(
    "/dashboard/stats",
    response_model=DashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated dashboard statistics",
    description="Aggregated totals for orders, revenue, active products, and low-inventory warnings. Protected by administrator verification.",
)
def get_dashboard_stats(
    low_stock_threshold: int = Query(5, ge=0, description="Threshold for low inventory alert"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DashboardStatsResponse:
    # 1. Total orders
    total_orders = db.query(func.count(Order.id)).scalar() or 0

    # 2. Total collected revenue (sum of total_amount across non-cancelled orders)
    total_revenue_raw = (
        db.query(func.coalesce(func.sum(Order.total_amount), 0.0))
        .filter(Order.status != "Cancelled")
        .scalar()
    )
    total_revenue = float(total_revenue_raw or 0.0)

    # 3. Total active products
    total_active_products = (
        db.query(func.count(Product.id)).filter(Product.active.is_(True)).scalar() or 0
    )

    # 4. Low stock products (active items with stock <= threshold)
    low_stock_products = (
        db.query(func.count(Product.id))
        .filter(Product.active.is_(True), Product.stock <= low_stock_threshold)
        .scalar()
        or 0
    )

    # 5. Total active categories
    total_categories = (
        db.query(func.count(Category.id)).filter(Category.active.is_(True)).scalar() or 0
    )

    # 6. Total registered customer patrons
    total_customers = (
        db.query(func.count(User.id)).filter(User.role == "customer").scalar() or 0
    )

    return DashboardStatsResponse(
        total_orders=total_orders,
        total_revenue=round(total_revenue, 2),
        total_active_products=total_active_products,
        low_stock_products=low_stock_products,
        low_stock_threshold=low_stock_threshold,
        total_categories=total_categories,
        total_customers=total_customers,
    )


@router.get(
    "/dashboard/recent-orders",
    response_model=List[RecentOrderSummary],
    status_code=status.HTTP_200_OK,
    summary="Get recent orders for admin overview",
    description="Lists the most recent customer orders sorted by creation time. Protected by administrator verification.",
)
def get_recent_orders(
    limit: int = Query(10, ge=1, le=50, description="Number of recent orders to retrieve"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[RecentOrderSummary]:
    orders = (
        db.query(Order)
        .options(joinedload(Order.user), joinedload(Order.items))
        .order_by(Order.created_at.desc())
        .limit(limit)
        .all()
    )

    summaries: List[RecentOrderSummary] = []
    for o in orders:
        items_count = sum(item.quantity for item in o.items) if o.items else 0
        shipping = o.shipping_address if isinstance(o.shipping_address, dict) else {}
        recipient_name = shipping.get("fullName") or shipping.get("name") or None
        recipient_email = shipping.get("email") or None
        account_name = o.user.name if o.user else None
        account_email = o.user.email if o.user else None

        display_name = recipient_name or account_name or "Recipient details unavailable"
        display_email = recipient_email or account_email or None

        summaries.append(
            RecentOrderSummary(
                id=o.id,
                order_number=o.order_number,
                status=o.status,
                total_amount=float(o.total_amount),
                subtotal=float(o.subtotal),
                shipping_amount=float(o.shipping_amount),
                customer_name=display_name,
                customer_email=display_email,
                recipient_name=recipient_name,
                account_name=account_name,
                created_at=o.created_at,
                items_count=items_count,
            )
        )

    return summaries


@router.get(
    "/dashboard/sales-summary",
    response_model=SalesSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get sales and order status overview",
    description="Calculates average order value and order status distribution. Protected by administrator verification.",
)
def get_sales_summary(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SalesSummaryResponse:
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    total_revenue_raw = (
        db.query(func.coalesce(func.sum(Order.total_amount), 0.0))
        .filter(Order.status != "Cancelled")
        .scalar()
    )
    total_revenue = float(total_revenue_raw or 0.0)

    # Average order value based on non-cancelled orders if any
    active_orders_count = db.query(func.count(Order.id)).filter(Order.status != "Cancelled").scalar() or 0
    avg_order_value = round(total_revenue / active_orders_count, 2) if active_orders_count > 0 else 0.0

    # Group by order status
    status_counts = (
        db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    )
    status_breakdown = {status_name: count for status_name, count in status_counts}

    return SalesSummaryResponse(
        total_revenue=round(total_revenue, 2),
        orders_count=total_orders,
        average_order_value=avg_order_value,
        status_breakdown=status_breakdown,
        has_data=total_orders > 0,
    )


import os
import uuid
import shutil
from fastapi import UploadFile, File, HTTPException
from app.api.deps import require_admin_secret

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB limit


@router.post(
    "/upload-image",
    status_code=status.HTTP_201_CREATED,
    summary="Upload image asset (Protected)",
    description="Upload a product or category image. Returns public URL path.",
)
async def upload_image(
    file: UploadFile = File(...),
    _admin: str = Depends(require_admin_secret),
) -> dict:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: '{file.content_type}'. Supported formats: JPEG, PNG, WebP, GIF, AVIF.",
        )

    # Determine extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext:
        ext = ".jpg" if "jpeg" in file.content_type else f".{file.content_type.split('/')[-1]}"

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    upload_dir = os.path.join("static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 10MB limit.",
        )

    with open(file_path, "wb") as f:
        f.write(contents)

    # Return relative URL
    return {
        "url": f"/static/uploads/{unique_filename}",
        "filename": unique_filename,
        "content_type": file.content_type,
        "size": len(contents),
    }

