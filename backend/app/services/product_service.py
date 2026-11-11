from typing import Optional, Tuple, List
from uuid import UUID
from math import ceil
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_
from fastapi import HTTPException, status
from app.models.product import Product
from app.models.category import Category
from app.schemas.product import ProductCreate, ProductUpdate


class ProductService:
    @staticmethod
    def list_products(
        db: Session,
        page: int = 1,
        limit: int = 20,
        category_id: Optional[UUID] = None,
        category_slug: Optional[str] = None,
        search: Optional[str] = None,
        sort: Optional[str] = None,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None,
        in_stock_only: Optional[bool] = None,
        min_rating: Optional[Decimal] = None,
        only_active: bool = True,
        stock_status: Optional[str] = None,
    ) -> Tuple[List[Product], int, int]:
        """
        List products with pagination, category filtering, search, and sorting.
        Returns (products, total_count, total_pages).
        """
        stmt = select(Product).options(joinedload(Product.category))

        if only_active:
            stmt = stmt.where(Product.active.is_(True))

        if category_id:
            stmt = stmt.where(Product.category_id == category_id)

        if category_slug and category_slug != "all":
            stmt = stmt.join(Product.category).where(Category.slug == category_slug.lower())

        if search and search.strip():
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Product.name.ilike(search_term),
                    Product.subtitle.ilike(search_term),
                    Product.description.ilike(search_term),
                    Product.materials.ilike(search_term),
                )
            )

        if min_price is not None:
            stmt = stmt.where(Product.price >= min_price)

        if max_price is not None:
            stmt = stmt.where(Product.price <= max_price)

        if in_stock_only:
            stmt = stmt.where(Product.stock > 0)

        if stock_status == "low_stock":
            stmt = stmt.where(Product.stock <= 5, Product.stock > 0)
        elif stock_status == "out_of_stock":
            stmt = stmt.where(Product.stock == 0)
        elif stock_status == "in_stock":
            stmt = stmt.where(Product.stock > 0)

        if min_rating is not None:
            stmt = stmt.where(Product.rating >= min_rating)

        # Count query
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        # Sorting
        if sort == "price-asc":
            stmt = stmt.order_by(Product.price.asc(), Product.id.asc())
        elif sort == "price-desc":
            stmt = stmt.order_by(Product.price.desc(), Product.id.asc())
        elif sort == "rating":
            stmt = stmt.order_by(Product.rating.desc(), Product.id.asc())
        elif sort == "newest":
            stmt = stmt.order_by(Product.created_at.desc(), Product.id.asc())
        elif sort == "featured":
            stmt = stmt.order_by(Product.featured.desc(), Product.created_at.desc(), Product.id.asc())
        else:
            stmt = stmt.order_by(Product.created_at.desc(), Product.id.asc())

        # Pagination
        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)
        items = list(db.scalars(stmt).unique().all())

        total_pages = ceil(total / limit) if limit > 0 else 1
        return items, total, total_pages

    @staticmethod
    def get_by_id(db: Session, product_id: UUID) -> Product:
        """Fetch a single product by UUID or raise 404."""
        stmt = (
            select(Product)
            .options(joinedload(Product.category))
            .where(Product.id == product_id)
        )
        product = db.scalars(stmt).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID '{product_id}' was not found.",
            )
        return product

    @staticmethod
    def get_by_slug(db: Session, slug: str) -> Optional[Product]:
        """Fetch a single product by unique slug."""
        stmt = (
            select(Product)
            .options(joinedload(Product.category))
            .where(Product.slug == slug)
        )
        return db.scalars(stmt).first()

    @staticmethod
    def create_product(db: Session, product_in: ProductCreate) -> Product:
        """Create a new product with validation of slug and category."""
        existing = ProductService.get_by_slug(db, product_in.slug)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A product with slug '{product_in.slug}' already exists.",
            )

        if product_in.category_id:
            category = db.get(Category, product_in.category_id)
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Referenced category ID '{product_in.category_id}' does not exist.",
                )

        product_data = product_in.model_dump()
        product = Product(**product_data)
        db.add(product)
        db.commit()
        db.refresh(product)
        return ProductService.get_by_id(db, product.id)

    @staticmethod
    def update_product(db: Session, product_id: UUID, product_in: ProductUpdate) -> Product:
        """Update an existing product."""
        product = ProductService.get_by_id(db, product_id)

        update_data = product_in.model_dump(exclude_unset=True)

        # Check slug collision if changing slug
        if "slug" in update_data and update_data["slug"] != product.slug:
            existing = ProductService.get_by_slug(db, update_data["slug"])
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A product with slug '{update_data['slug']}' already exists.",
                )

        # Verify category if updating category_id
        if "category_id" in update_data and update_data["category_id"] is not None:
            category = db.get(Category, update_data["category_id"])
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Referenced category ID '{update_data['category_id']}' does not exist.",
                )

        for field, value in update_data.items():
            setattr(product, field, value)

        db.commit()
        db.refresh(product)
        return ProductService.get_by_id(db, product.id)

    @staticmethod
    def delete_product(db: Session, product_id: UUID, soft: bool = True) -> dict:
        """
        Safely delete a product. Soft delete sets active=False to preserve
        historical order snapshots and referential integrity.
        """
        product = ProductService.get_by_id(db, product_id)

        if soft:
            product.active = False
            db.commit()
            return {"message": "Product deactivated successfully.", "id": str(product_id), "active": False}
        else:
            db.delete(product)
            db.commit()
            return {"message": "Product deleted permanently.", "id": str(product_id)}

    @staticmethod
    def update_stock(db: Session, product_id: UUID, new_stock: int, reason: Optional[str] = None) -> Product:
        """
        Atomically update stock quantity for a product with non-negative validation.
        """
        if new_stock < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Stock quantity cannot be negative.",
            )
        product = ProductService.get_by_id(db, product_id)
        product.stock = new_stock
        db.commit()
        db.refresh(product)
        return ProductService.get_by_id(db, product.id)

