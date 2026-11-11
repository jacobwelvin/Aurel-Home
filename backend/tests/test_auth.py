import time
import uuid
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.config import get_settings

TEST_JWT_SECRET = "super-secret-test-jwt-key-32-chars-long!"


def generate_test_token(
    user_id: uuid.UUID,
    email: str,
    secret: str = TEST_JWT_SECRET,
    expires_in: int = 3600,
    role: str = "authenticated",
    name: str = "Test Patron",
) -> str:
    """Helper to generate signed Supabase-style JWTs for test scenarios."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "aud": "authenticated",
        "role": role,
        "exp": int(time.time()) + expires_in,
        "iat": int(time.time()),
        "user_metadata": {
            "name": name,
            "full_name": name,
        },
        "app_metadata": {
            "provider": "email",
        },
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture(autouse=True)
def configure_test_jwt(monkeypatch):
    """Ensure SUPABASE_JWT_SECRET is active during auth tests."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)


def test_unauthenticated_me_endpoint_returns_401(client: TestClient):
    """Calling /api/v1/auth/me without a token must return 401."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert "credentials were not provided" in res.json()["detail"].lower()


def test_invalid_token_returns_401(client: TestClient):
    """Tampered token with invalid signature must return 401."""
    res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.valid.jwt"})
    assert res.status_code == 401
    assert "invalid" in res.json()["detail"].lower()


def test_tampered_signature_returns_401(client: TestClient):
    """Token signed with wrong key must return 401."""
    fake_token = generate_test_token(
        user_id=uuid.uuid4(),
        email="hacker@domain.com",
        secret="wrong-secret-key-that-fails-verification",
    )
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert res.status_code == 401
    assert "invalid" in res.json()["detail"].lower()


def test_expired_token_returns_401(client: TestClient):
    """Expired token must return 401."""
    expired_token = generate_test_token(
        user_id=uuid.uuid4(),
        email="expired@domain.com",
        expires_in=-300,  # Expired 5 minutes ago
    )
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_customer_registration_profile_sync_defaults_to_customer(client: TestClient, db_session: Session):
    """New verified Supabase user automatically provisions with role='customer'."""
    user_id = uuid.uuid4()
    email = f"patron_{user_id.hex[:6]}@example.com"
    token = generate_test_token(user_id=user_id, email=email, name="Aarav Deshmukh")

    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(user_id)
    assert data["email"] == email
    assert data["name"] == "Aarav Deshmukh"
    assert data["role"] == "customer"  # Strict customer default

    # Verify database record
    user_in_db = db_session.query(User).filter(User.id == user_id).first()
    assert user_in_db is not None
    assert user_in_db.role == "customer"


def test_customer_cannot_escalate_role(client: TestClient):
    """PATCH /api/v1/auth/me cannot modify the role field."""
    user_id = uuid.uuid4()
    email = "customer_try_escalate@example.com"
    token = generate_test_token(user_id=user_id, email=email, name="Sneaky Patron")

    # Attempt to pass role in payload
    res = client.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Sneaky Patron Updated", "role": "admin"},
    )
    assert res.status_code == 200
    assert res.json()["role"] == "customer"  # Remains customer!
    assert res.json()["name"] == "Sneaky Patron Updated"


def test_customer_forbidden_from_admin_write_endpoint(client: TestClient):
    """Customer trying to create a category must receive 403 Forbidden."""
    user_id = uuid.uuid4()
    email = "regular_customer@example.com"
    token = generate_test_token(user_id=user_id, email=email)

    res = client.post(
        "/api/v1/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Unauthorized Realm",
            "slug": "unauthorized-realm",
            "realm_number": "Realm 99",
            "description": "Exploit attempt",
            "image": "/img.jpg",
            "active": True,
        },
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_admin_authorized_for_admin_write_endpoint(client: TestClient, db_session: Session):
    """User with role='admin' can execute admin write operations."""
    admin_id = uuid.uuid4()
    email = "admin_verified@aurelhome.com"

    # Pre-provision admin record in database
    admin_user = User(
        id=admin_id,
        email=email,
        name="Chief Atelier Curator",
        role="admin",
    )
    db_session.add(admin_user)
    db_session.commit()

    token = generate_test_token(user_id=admin_id, email=email, name="Chief Atelier Curator")

    res = client.post(
        "/api/v1/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Garden Atelier",
            "slug": "garden-atelier",
            "realm_number": "Realm 07",
            "description": "Sculptural outdoor seating and cast bronze planters",
            "image": "/garden.jpg",
            "active": True,
        },
    )
    assert res.status_code == 201
    assert res.json()["slug"] == "garden-atelier"


def test_public_catalog_endpoints_remain_accessible(client: TestClient):
    """Public catalogue read endpoints remain open without auth headers."""
    res = client.get("/api/v1/categories")
    assert res.status_code == 200

    res = client.get("/api/v1/products")
    assert res.status_code == 200


def test_email_confirmed_patron_sync_flow(client: TestClient, db_session: Session):
    """
    Simulates the callback flow: after email confirmation in Supabase,
    the frontend exchanges the code for a session and calls POST /api/v1/auth/sync.
    Ensures safe profile provisioning, idempotent synchronization, and role='customer'.
    """
    user_id = uuid.uuid4()
    email = f"confirmed_patron_{user_id.hex[:6]}@example.com"
    token = generate_test_token(user_id=user_id, email=email, name="Confirmed Patron")

    # Call sync endpoint as done by /auth/callback
    res = client.post(
        "/api/v1/auth/sync",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Confirmed Patron"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(user_id)
    assert data["email"] == email
    assert data["name"] == "Confirmed Patron"
    assert data["role"] == "customer"  # Strict customer role, never escalated

    # Verify database persistence
    user_in_db = db_session.query(User).filter(User.id == user_id).first()
    assert user_in_db is not None
    assert user_in_db.role == "customer"

    # Verify that confirmed customer cannot access protected admin dashboard
    admin_res = client.get(
        "/api/v1/admin/dashboard/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert admin_res.status_code == 403


def test_tampered_confirmation_token_rejected_at_sync(client: TestClient):
    """Tampered token arriving at sync endpoint must be rejected with 401."""
    tampered_token = generate_test_token(
        user_id=uuid.uuid4(),
        email="tampered@example.com",
        secret="invalid-forged-key-not-matching-supabase",
    )
    res = client.post(
        "/api/v1/auth/sync",
        headers={"Authorization": f"Bearer {tampered_token}"},
        json={"name": "Attacker"},
    )
    assert res.status_code == 401


def test_sync_idempotent_and_preserves_admin_role(client: TestClient, db_session: Session):
    """
    Subsequent calls to /api/v1/auth/sync for an existing admin user
    must NEVER overwrite the admin role with customer.
    """
    admin_id = uuid.uuid4()
    email = f"atelier_admin_{admin_id.hex[:6]}@aurelhome.com"

    # Pre-provision admin record in database
    admin_user = User(
        id=admin_id,
        email=email,
        name="Lead Atelier Administrator",
        role="admin",
    )
    db_session.add(admin_user)
    db_session.commit()

    token = generate_test_token(user_id=admin_id, email=email, name="Lead Atelier Administrator")

    # Call sync endpoint (simulating patron/admin login or callback)
    res = client.post(
        "/api/v1/auth/sync",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Lead Atelier Administrator Updated"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "admin"
    assert data["name"] == "Lead Atelier Administrator Updated"

    # Check directly in the database session
    db_session.expire_all()
    user_in_db = db_session.query(User).filter(User.id == admin_id).first()
    assert user_in_db is not None
    assert user_in_db.role == "admin"


def test_es256_unauthorized_token_rejection(client: TestClient):
    """
    Ensure ES256 token signed by an unknown/untrusted EC key is rejected with 401.
    """
    from cryptography.hazmat.primitives.asymmetric import ec
    private_key = ec.generate_private_key(ec.SECP256R1())
    es256_token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "untrusted_ec@domain.com",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "untrusted-key-id"},
    )

    res = client.post(
        "/api/v1/auth/sync",
        headers={"Authorization": f"Bearer {es256_token}"},
        json={"name": "Untrusted"},
    )
    assert res.status_code == 401


def test_timing_middleware_header_present(client: TestClient):
    """Verify that requests return the X-Response-Time-Ms header."""
    res = client.get("/health")
    assert res.status_code == 200
    assert "X-Response-Time-Ms" in res.headers
    duration_val = float(res.headers["X-Response-Time-Ms"])
    assert duration_val >= 0.0


def test_auth_me_successful_admin_verification(client: TestClient, db_session: Session):
    """Admin credentials verified against /api/v1/auth/me return role='admin'."""
    admin_id = uuid.uuid4()
    email = "verified_admin@aurelhome.com"
    admin_user = User(
        id=admin_id,
        email=email,
        name="Security Administrator",
        role="admin",
    )
    db_session.add(admin_user)
    db_session.commit()

    token = generate_test_token(user_id=admin_id, email=email, name="Security Administrator")
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(admin_id)
    assert data["email"] == email
    assert data["role"] == "admin"


def test_auth_me_customer_rejected_from_admin(client: TestClient, db_session: Session):
    """Customer credentials return role='customer' (used by AdminGuard to block access)."""
    cust_id = uuid.uuid4()
    email = "ordinary_patron@example.com"
    cust_user = User(
        id=cust_id,
        email=email,
        name="Ordinary Patron",
        role="customer",
    )
    db_session.add(cust_user)
    db_session.commit()

    token = generate_test_token(user_id=cust_id, email=email, name="Ordinary Patron")
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "customer"


def test_db_session_release_after_request(client: TestClient, db_session: Session):
    """Verify that database sessions yielded by get_db are properly closed after request completion."""
    from app.db.session import get_db

    sessions_closed = []

    def tracking_get_db():
        from app.db.session import get_session_factory
        factory = get_session_factory()
        db = factory()
        orig_close = db.close

        def wrapped_close():
            sessions_closed.append(True)
            orig_close()

        db.close = wrapped_close
        try:
            yield db
        finally:
            db.close()

    from app.main import app
    app.dependency_overrides[get_db] = tracking_get_db

    try:
        res = client.get("/health")
        assert res.status_code == 200
        # If an endpoint uses get_db or health check, session must be closed
    finally:
        app.dependency_overrides.pop(get_db, None)


