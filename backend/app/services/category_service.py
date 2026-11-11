from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    @staticmethod
    def list_categories(db: Session, only_active: bool = True) -> List[Category]:
        """Fetch categories ordered by name with active product count."""
        stmt = (
            select(Category, func.count(Product.id).label("item_count"))
            .outerjoin(Product, (Product.category_id == Category.id) & (Product.active.is_(True)))
        )
        if only_active:
            stmt = stmt.where(Category.active.is_(True))
        stmt = stmt.group_by(Category.id).order_by(Category.name.asc())
        
        results = []
        for cat, count in db.execute(stmt).all():
            cat.item_count = count
            results.append(cat)
        return results

    @staticmethod
    def get_by_id(db: Session, category_id: UUID) -> Category:
        """Fetch a category by UUID or raise 404."""
        category = db.get(Category, category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with ID '{category_id}' not found.",
            )
        count = db.scalar(
            select(func.count(Product.id)).where(
                (Product.category_id == category.id) & (Product.active.is_(True))
            )
        )
        category.item_count = count or 0
        return category

    @staticmethod
    def get_by_slug(db: Session, slug: str) -> Optional[Category]:
        """Lookup a category by unique slug."""
        stmt = select(Category).where(Category.slug == slug)
        category = db.scalars(stmt).first()
        if category:
            count = db.scalar(
                select(func.count(Product.id)).where(
                    (Product.category_id == category.id) & (Product.active.is_(True))
                )
            )
            category.item_count = count or 0
        return category

    @staticmethod
    def create_category(db: Session, category_in: CategoryCreate) -> Category:
        """Create a new category ensuring unique slug."""
        existing = CategoryService.get_by_slug(db, category_in.slug)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A category with slug '{category_in.slug}' already exists.",
            )
        category = Category(**category_in.model_dump())
        db.add(category)
        db.commit()
        db.refresh(category)
        category.item_count = 0
        return category

    @staticmethod
    def update_category(db: Session, category_id: UUID, category_in: CategoryUpdate) -> Category:
        """Update an existing category with conflict and validation checks."""
        category = CategoryService.get_by_id(db, category_id)

        update_data = category_in.model_dump(exclude_unset=True)

        # Check slug conflict if changing slug
        if "slug" in update_data and update_data["slug"] != category.slug:
            existing = CategoryService.get_by_slug(db, update_data["slug"])
            if existing and existing.id != category_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A category with slug '{update_data['slug']}' already exists.",
                )

        for field, value in update_data.items():
            setattr(category, field, value)

        db.commit()
        db.refresh(category)

        count = db.scalar(
            select(func.count(Product.id)).where(
                (Product.category_id == category.id) & (Product.active.is_(True))
            )
        )
        category.item_count = count or 0
        return category

    @staticmethod
    def delete_category(db: Session, category_id: UUID, soft: bool = True) -> dict:
        """
        Safely delete or deactivate a category.
        Rejects deletion if products are currently assigned to avoid orphaning.
        """
        category = CategoryService.get_by_id(db, category_id)

        # Count assigned products (both active and inactive)
        product_count = db.scalar(
            select(func.count(Product.id)).where(Product.category_id == category_id)
        ) or 0

        if not soft:
            if product_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot delete realm '{category.name}' because {product_count} product(s) "
                        "are assigned to it. Reassign or delete these products first, or deactivate the realm."
                    ),
                )
            db.delete(category)
            db.commit()
            return {"message": f"Category '{category.name}' deleted successfully.", "id": str(category_id)}
        else:
            category.active = False
            db.commit()
            return {
                "message": f"Category '{category.name}' deactivated successfully.",
                "id": str(category_id),
                "active": False,
                "assigned_products": product_count,
            }
