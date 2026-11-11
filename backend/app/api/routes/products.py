from typing import Optional
from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.product import (
    ProductResponse,
    ProductCreate,
    ProductUpdate,
    ProductListResponse,
    StockAdjustment,
)
from app.services.product_service import ProductService
from app.api.deps import require_admin_secret

router = APIRouter(prefix="/products", tags=["Products"])


@router.get(
    "",
    response_model=ProductListResponse,
    status_code=status.HTTP_200_OK,
    summary="List products with pagination and filters",
    description="Retrieve a paginated list of catalog products with optional category, search, sorting, stock status, and price filters.",
)
def list_products(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    category_id: Optional[UUID] = Query(None, description="Filter by category UUID"),
    category_slug: Optional[str] = Query(None, description="Filter by category slug (e.g. 'living', 'bedroom')"),
    search: Optional[str] = Query(None, description="Search query against name, materials, or description"),
    sort: Optional[str] = Query(None, description="Sort order: 'featured', 'price-asc', 'price-desc', 'rating', 'newest'"),
    min_price: Optional[Decimal] = Query(None, ge=0, description="Minimum price filter"),
    max_price: Optional[Decimal] = Query(None, ge=0, description="Maximum price filter"),
    in_stock_only: Optional[bool] = Query(None, description="Filter for products in stock"),
    stock_status: Optional[str] = Query(None, description="Filter by stock status: 'in_stock', 'low_stock', 'out_of_stock'"),
    min_rating: Optional[Decimal] = Query(None, ge=0, le=5, description="Minimum customer rating"),
    only_active: bool = Query(True, description="Filter only active products"),
    db: Session = Depends(get_db),
) -> ProductListResponse:
    items, total, pages = ProductService.list_products(
        db=db,
        page=page,
        limit=limit,
        category_id=category_id,
        category_slug=category_slug,
        search=search,
        sort=sort,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        stock_status=stock_status,
        min_rating=min_rating,
        only_active=only_active,
    )
    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get(
    "/slug/{slug}",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve product by unique slug",
    description="Fetch a single catalog product by its unique URL slug.",
)
def get_product_by_slug(
    slug: str,
    db: Session = Depends(get_db),
) -> ProductResponse:
    product = ProductService.get_by_slug(db=db, slug=slug)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with slug '{slug}' was not found.",
        )
    return ProductResponse.model_validate(product)


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve product by ID",
    description="Fetch a single catalog product by its UUID.",
)
def get_product(
    product_id: UUID,
    db: Session = Depends(get_db),
) -> ProductResponse:
    product = ProductService.get_by_id(db=db, product_id=product_id)
    return ProductResponse.model_validate(product)


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create product (Protected)",
    description="Create a new catalog product. Requires X-Admin-API-Key header.",
)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin_secret),
) -> ProductResponse:
    product = ProductService.create_product(db=db, product_in=product_in)
    return ProductResponse.model_validate(product)


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
    summary="Update product (Protected)",
    description="Partially update an existing product. Requires X-Admin-API-Key header.",
)
@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
    summary="Update product (Protected)",
    description="Update an existing product via PUT. Requires X-Admin-API-Key header.",
)
def update_product(
    product_id: UUID,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin_secret),
) -> ProductResponse:
    product = ProductService.update_product(db=db, product_id=product_id, product_in=product_in)
    return ProductResponse.model_validate(product)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete / deactivate product (Protected)",
    description="Safely deactivates product to protect historical orders. Requires X-Admin-API-Key header.",
)
def delete_product(
    product_id: UUID,
    soft: bool = Query(True, description="Soft delete (deactivate) or hard delete"),
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin_secret),
) -> dict:
    return ProductService.delete_product(db=db, product_id=product_id, soft=soft)


@router.patch(
    "/{product_id}/stock",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
    summary="Adjust product stock (Protected)",
    description="Atomically updates inventory stock quantity for a product. Requires X-Admin-API-Key or admin JWT.",
)
def adjust_stock(
    product_id: UUID,
    stock_in: StockAdjustment,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin_secret),
) -> ProductResponse:
    product = ProductService.update_stock(
        db=db,
        product_id=product_id,
        new_stock=stock_in.stock,
        reason=stock_in.reason,
    )
    return ProductResponse.model_validate(product)

