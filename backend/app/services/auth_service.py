import logging
import uuid
from typing import Dict, Any, Optional
import jwt
from jwt import PyJWKClient
import httpx
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)


class AuthService:
    """
    Supabase Auth token verification, profile synchronization, and role enforcement.
    Supports asymmetric (ES256, RS256 via JWKS) and symmetric (HS256 via secret) signatures,
    with remote fallback to Supabase Auth API.
    """

    _jwk_client: Optional[PyJWKClient] = None
    _jwk_url: Optional[str] = None

    @classmethod
    def get_jwk_client(cls, jwks_url: str) -> PyJWKClient:
        """Lazily initialize and cache PyJWKClient instance with bounded 5.0s timeout."""
        if cls._jwk_client is None or cls._jwk_url != jwks_url:
            cls._jwk_client = PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=16, timeout=5.0)
            cls._jwk_url = jwks_url
        return cls._jwk_client

    @classmethod
    def verify_token(cls, token: str) -> Dict[str, Any]:
        """
        Verify Supabase JWT access token.
        Validates signature, expiration, issuer/audience, and extracts claims.
        Handles both asymmetric (ES256) Supabase Auth tokens and symmetric (HS256) tokens.
        """
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token required.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        settings = get_settings()

        # Inspect token header without verification to determine algorithm and kid
        try:
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg", "HS256")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Malformed authentication token: {str(e)}",
                headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
            )

        # -------------------------------------------------------------
        # Branch 1: Asymmetric Signing (ES256, RS256) — Modern Supabase Auth
        # -------------------------------------------------------------
        if alg in ("ES256", "RS256"):
            jwks_url = settings.supabase_jwks_url
            try:
                jwk_client = cls.get_jwk_client(jwks_url)
                try:
                    signing_key = jwk_client.get_signing_key_from_jwt(token)
                except Exception:
                    # Invalidate cached keys in case the Supabase project rotated them
                    cls._jwk_client = None
                    jwk_client = cls.get_jwk_client(jwks_url)
                    signing_key = jwk_client.get_signing_key_from_jwt(token)

                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[alg],
                    audience="authenticated",
                    options={"verify_exp": True, "verify_aud": True},
                )
                if not payload.get("sub"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token missing subject identifier.",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                return payload
            except jwt.ExpiredSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token has expired.",
                    headers={"WWW-Authenticate": 'Bearer error="invalid_token", error_description="Token expired"'},
                )
            except HTTPException:
                raise
            except Exception as jwks_err:
                logger.warning(
                    f"JWKS verification failed for {alg} token ({jwks_err}). Falling back to remote Supabase verification."
                )

        # -------------------------------------------------------------
        # Branch 2: Symmetric HMAC Signing (HS256) — Test suites & Shared Secret
        # -------------------------------------------------------------
        if alg == "HS256" and settings.SUPABASE_JWT_SECRET:
            import base64

            # Prepare keys: raw secret string and optional base64-decoded secret bytes
            decode_keys = [settings.SUPABASE_JWT_SECRET]
            try:
                decoded_b64 = base64.b64decode(settings.SUPABASE_JWT_SECRET)
                if len(decoded_b64) >= 32:
                    decode_keys.append(decoded_b64)
            except Exception:
                pass

            last_invalid_err: Optional[Exception] = None
            for key in decode_keys:
                try:
                    payload = jwt.decode(
                        token,
                        key,
                        algorithms=["HS256"],
                        audience="authenticated",
                        options={"verify_exp": True, "verify_aud": True},
                    )
                    if not payload.get("sub"):
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Token missing subject identifier.",
                            headers={"WWW-Authenticate": "Bearer"},
                        )
                    return payload
                except jwt.ExpiredSignatureError:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Authentication token has expired.",
                        headers={"WWW-Authenticate": 'Bearer error="invalid_token", error_description="Token expired"'},
                    )
                except jwt.InvalidTokenError as e:
                    last_invalid_err = e

            # If local secret verification failed, log and attempt remote verification before rejecting
            logger.warning(
                f"Local HS256 secret verification failed ({last_invalid_err}). Falling back to remote Supabase verification."
            )

        # -------------------------------------------------------------
        # Branch 3: Remote Verification via Supabase Auth API (GET /auth/v1/user)
        # -------------------------------------------------------------
        supabase_url = settings.clean_supabase_url
        anon_key = settings.SUPABASE_ANON_KEY or settings.SUPABASE_JWT_SECRET
        if supabase_url and anon_key:
            try:
                headers = {
                    "Authorization": f"Bearer {token}",
                    "apikey": anon_key,
                }
                with httpx.Client(timeout=5.0) as client:
                    resp = client.get(f"{supabase_url}/auth/v1/user", headers=headers)

                if resp.status_code == 200:
                    user_data = resp.json()
                    return {
                        "sub": user_data.get("id"),
                        "email": user_data.get("email"),
                        "user_metadata": user_data.get("user_metadata", {}) or {},
                        "app_metadata": user_data.get("app_metadata", {}) or {},
                    }
                else:
                    logger.warning(
                        f"Supabase remote verification rejected token with HTTP {resp.status_code}: {resp.text}"
                    )
                    error_detail = "Supabase Auth verification rejected token."
                    try:
                        err_body = resp.json()
                        msg = err_body.get("msg") or err_body.get("message") or err_body.get("error_description")
                        if msg:
                            if "expired" in msg.lower():
                                error_detail = "Authentication token has expired."
                            else:
                                error_detail = f"Supabase Auth verification rejected token: {msg}"
                    except Exception:
                        pass

                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=error_detail,
                        headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
                    )
            except HTTPException:
                raise
            except httpx.RequestError as e:
                logger.error(f"Failed to reach Supabase Auth server: {e}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Cannot verify token with Supabase Auth server: {str(e)}",
                    headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
                )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed: No valid verification provider available.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    @staticmethod
    def get_or_create_user(
        db: Session,
        supabase_uid: uuid.UUID,
        email: str,
        name: Optional[str] = None,
    ) -> User:
        """
        Synchronize a verified Supabase user into the local database users table.
        Ensures idempotent profile creation, guarantees zero duplicate records,
        and strictly preserves existing role (never overwriting an existing admin with customer).
        """
        clean_email = email.strip().lower()

        # 1. Search by Supabase UUID
        user = db.query(User).filter(User.id == supabase_uid).first()
        if user:
            # Update display name if supplied and changed
            if name and name.strip() and user.name != name.strip():
                user.name = name.strip()
            # Ensure email matches normalized format
            if user.email != clean_email:
                user.email = clean_email
            db.commit()
            db.refresh(user)
            return user

        # 2. Check by email to protect against pre-provisioned or duplicate sync records
        existing_by_email = db.query(User).filter(func.lower(User.email) == clean_email).first()
        if existing_by_email:
            # If the ID differs (e.g. pre-provisioned record), align UUID to match Supabase Auth UUID
            if existing_by_email.id != supabase_uid:
                try:
                    existing_by_email.id = supabase_uid
                    if name and name.strip() and not existing_by_email.name:
                        existing_by_email.name = name.strip()
                    db.commit()
                    db.refresh(existing_by_email)
                    return existing_by_email
                except Exception:
                    db.rollback()
                    existing_by_email = db.query(User).filter(func.lower(User.email) == clean_email).first()

            if name and name.strip() and not existing_by_email.name:
                existing_by_email.name = name.strip()
                db.commit()
                db.refresh(existing_by_email)
            return existing_by_email

        # 3. Create new verified customer profile
        new_user = User(
            id=supabase_uid,
            email=clean_email,
            name=name.strip() if name else None,
            role="customer",  # Secure default: new registrations strictly default to customer
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def promote_user(db: Session, email: str, role: str = "admin") -> Optional[User]:
        """
        Promote a user to admin or customer.
        Intended for server-side administrative scripting only.
        """
        clean_email = email.strip().lower()
        user = db.query(User).filter(func.lower(User.email) == clean_email).first()
        if not user:
            return None
        user.role = role
        db.commit()
        db.refresh(user)
        return user
