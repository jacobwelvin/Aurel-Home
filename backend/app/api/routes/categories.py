from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.category import CategoryResponse, CategoryCreate, CategoryUpdate
from app.services.category_service import CategoryService
from app.api.deps import require_admin_secret
from fastapi import Query

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get(
    "",
    response_model=List[CategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="List categories",
    description="Retrieve catalog categories representing Aurel Home design realms. Supports only_active filter.",
)
def list_categories(
    only_active: bool = Query(True, description="Filter only active categories"),
    db: Session = Depends(get_db),
) -> List[CategoryResponse]:
    categories = CategoryService.list_categories(db=db, only_active=only_active)
    return [CategoryResponse.model_validate(c) for c in categories]


@router.get(
    "/slug/{slug}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get category by slug",
    description="Retrieve a single category by its unique URL slug.",
)
def get_category_by_slug(
    slug: str,
    db: Session = Depends(get_db),
) -> CategoryResponse:
    category = CategoryService.get_by_slug(db=db, slug=slug)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with slug '{slug}' not found.",
        )
    return CategoryResponse.model_validate(category)


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get category details",
    description="Retrieve a single category by its unique UUID.",
)
def get_category(
    category_id: UUID,
    db: Session = Depends(get_db),
) -> CategoryResponse:
    category = CategoryService.get_by_id(db=db, category_id=category_id)
    return CategoryResponse.model_validate(category)


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create category (Protected)",
    description="Create a new design category. Protected by administrator verification.",
)
def create_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin_secret),
) -> CategoryResponse:
    category = CategoryService.create_category(db=db, category_in=category_in)
    return CategoryResponse.model_validate(category)


@router.patch(
    "/{category_id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update category (Protected)",
    description="Partially update an existing category. Protected by administrator verification.",
)
def update_category(
    category_id: UUID,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin_secret),
) -> CategoryResponse:
    category = CategoryService.update_category(db=db, category_id=category_id, category_in=category_in)
    return CategoryResponse.model_validate(category)


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete / deactivate category (Protected)",
    description="Safely deletes or deactivates a category. Rejects deletion if products are currently assigned.",
)
def delete_category(
    category_id: UUID,
    soft: bool = Query(True, description="Soft delete (deactivate) or hard delete"),
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin_secret),
) -> dict:
    return CategoryService.delete_category(db=db, category_id=category_id, soft=soft)

