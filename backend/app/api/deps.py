import logging
import hmac
import uuid
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)
security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency that extracts and verifies Supabase Bearer JWT,
    synchronizing and returning the authenticated User model.
    Raises 401 Unauthorized if missing, expired, or invalid.
    """
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth.credentials
    claims = AuthService.verify_token(token)

    sub_str = claims.get("sub")
    if not sub_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        supabase_uid = uuid.UUID(sub_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid subject UUID format.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = claims.get("email") or f"{sub_str}@patron.aurelhome.com"
    user_metadata = claims.get("user_metadata", {}) or {}
    name = user_metadata.get("name") or user_metadata.get("full_name")

    # Fetch or safely sync profile into PostgreSQL
    user = AuthService.get_or_create_user(
        db=db,
        supabase_uid=supabase_uid,
        email=email,
        name=name,
    )
    return user


def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Optional user dependency: returns authenticated User if valid Bearer JWT present,
    or None if absent, guest, or unverified.
    """
    if not auth or not auth.credentials:
        return None
    try:
        return get_current_user(auth=auth, db=db)
    except HTTPException:
        return None


def require_admin(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    x_admin_api_key: Optional[str] = Header(
        None,
        alias="X-Admin-API-Key",
        description="Administrative secret key for backend automation (disabled by default)",
    ),
    db: Session = Depends(get_db),
) -> User:
    """
    Enforces administrator authorization. Two paths:

    1. **Primary (JWT):** Validates Bearer JWT via Supabase, loads the user from
       the database, and checks ``users.role == 'admin'``.
    2. **Legacy (API Key):** Only available when ``ADMIN_API_KEY`` is explicitly
       configured in ``.env`` with a high-entropy value (>= 32 chars, not a known
       default). Uses constant-time comparison. Requires an existing admin record
       in the database — never creates an in-memory fallback admin.

    Raises:
      - 401 Unauthorized if no credentials or invalid token.
      - 403 Forbidden if authenticated but not an admin.
    """
    settings = get_settings()

    # Path 1 (preferred): Supabase JWT authentication with database role check
    if auth and auth.credentials:
        user = get_current_user(auth=auth, db=db)
        if user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Administrator privileges required.",
            )
        return user

    # Path 2 (legacy/automation): API key — only if explicitly enabled
    if x_admin_api_key:
        if not settings.admin_api_key_enabled:
            logger.warning("Admin API key authentication attempted but ADMIN_API_KEY is not configured or uses an insecure default.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key authentication is not enabled. Use Bearer JWT authentication.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(
            x_admin_api_key.encode("utf-8"),
            settings.ADMIN_API_KEY.strip().encode("utf-8"),
        ):
            logger.warning("Admin API key authentication failed: invalid key provided.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid administrative API key.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # API key is valid — require an existing admin record in the database
        system_admin = db.query(User).filter(User.role == "admin").first()
        if not system_admin:
            logger.error("Admin API key is valid but no admin user exists in the database.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No administrator account exists. Use the promote_admin.py script to designate an administrator.",
            )

        logger.info("Admin API key authentication successful for automation request.")
        return system_admin

    # Neither JWT nor API key provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials were not provided. Provide a Bearer JWT token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


# Alias for backward compatibility with existing code
require_admin_secret = require_admin
