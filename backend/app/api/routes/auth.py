from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserProfileSync
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user profile",
    description="Retrieve the profile and role of the currently authenticated patron or administrator.",
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update authenticated user profile",
    description="Update editable profile fields (name). Customer role cannot be self-escalated.",
)
def update_my_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    if payload.name is not None:
        current_user.name = payload.name.strip()
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post(
    "/sync",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Synchronize patron profile",
    description="Synchronizes user metadata from Supabase Auth into the application profile table.",
)
def sync_profile(
    payload: UserProfileSync,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    if payload.name and (not current_user.name or current_user.name != payload.name):
        current_user.name = payload.name.strip()
        db.commit()
        db.refresh(current_user)
    return UserResponse.model_validate(current_user)
