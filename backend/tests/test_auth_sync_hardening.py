"""
Targeted tests for Aurel Home authentication synchronization hardening,
token verification resilience, expiration diagnostics, and customer data isolation.
"""
import base64
import time
import uuid
import jwt
import pytest
import httpx
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.category import Category
from app.core.config import get_settings
from app.services.auth_service import AuthService
from tests.test_auth import generate_test_token, TEST_JWT_SECRET


@pytest.fixture(autouse=True)
def configure_test_jwt(monkeypatch):
    """Ensure SUPABASE_JWT_SECRET is active during tests."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)


class TestAuthTokenVerificationHardening:
    """Tests for cryptographic verification resilience across algorithms and formats."""

    def test_base64_encoded_jwt_secret_supported(self, monkeypatch):
        """Tokens signed with a base64-decoded secret verify cleanly."""
        raw_key_bytes = b"01234567890123456789012345678901"  # 32 bytes
        b64_secret = base64.b64encode(raw_key_bytes).decode("utf-8")
        monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", b64_secret)

        user_id = uuid.uuid4()
        payload = {
            "sub": str(user_id),
            "email": "b64_patron@example.com",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        }
        # Token signed with the decoded raw bytes (standard Supabase pattern)
        token = jwt.encode(payload, raw_key_bytes, algorithm="HS256")

        verified = AuthService.verify_token(token)
        assert verified["sub"] == str(user_id)
        assert verified["email"] == "b64_patron@example.com"

    def test_raw_string_jwt_secret_supported(self, monkeypatch):
        """Tokens signed with a standard UTF-8 string secret verify cleanly."""
        str_secret = "my-super-secret-string-key-32chars!!"
        monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", str_secret)

        user_id = uuid.uuid4()
        payload = {
            "sub": str(user_id),
            "email": "str_patron@example.com",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, str_secret, algorithm="HS256")

        verified = AuthService.verify_token(token)
        assert verified["sub"] == str(user_id)
        assert verified["email"] == "str_patron@example.com"

    def test_expired_token_returns_401_with_standard_header(self, client: TestClient):
        """Expired tokens must return 401 with WWW-Authenticate header indicating token expiration."""
        user_id = uuid.uuid4()
        token = generate_test_token(user_id=user_id, email="expired@example.com", expires_in=-300)

        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401
        assert "expired" in res.json()["detail"].lower()
        auth_header = res.headers.get("WWW-Authenticate", "")
        assert "invalid_token" in auth_header

    def test_token_missing_subject_rejected(self, client: TestClient):
        """Token with no 'sub' claim must be rejected with 401."""
        payload = {
            "email": "nosub@example.com",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")

        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401
        assert "missing subject" in res.json()["detail"].lower()

    def test_token_with_invalid_uuid_subject_rejected(self, client: TestClient):
        """Token with non-UUID 'sub' format must be rejected with 401."""
        payload = {
            "sub": "not-a-valid-uuid-12345",
            "email": "baduuid@example.com",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")

        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401
        assert "uuid format" in res.json()["detail"].lower()

    def test_remote_verification_rejection_diagnostics(self, client: TestClient, monkeypatch):
        """When remote Supabase auth rejects token, 401 is returned with diagnostics."""
        # Force fallback to Branch 3 by disabling local secret
        monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", None)
        monkeypatch.setattr(get_settings(), "SUPABASE_ANON_KEY", "mock-anon-key")

        # Mock httpx to simulate Supabase returning a 401 rejection
        class MockResponse:
            status_code = 401
            text = '{"msg": "Invalid token: token is expired"}'

            def json(self):
                return {"msg": "Invalid token: token is expired"}

        class MockClient:
            def __init__(self, *args, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def get(self, *args, **kwargs):
                return MockResponse()

        monkeypatch.setattr("app.services.auth_service.httpx.Client", MockClient)

        dummy_jwt = jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated"}, "01234567890123456789012345678901", algorithm="HS256")
        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {dummy_jwt}"})
        assert res.status_code == 401
        assert "expired" in res.json()["detail"].lower()

    def test_valid_es256_token_verifies_successfully(self, monkeypatch):
        """ES256 token signed by an EC key verifies via JWKS client."""
        from cryptography.hazmat.primitives.asymmetric import ec
        priv = ec.generate_private_key(ec.SECP256R1())
        pub = priv.public_key()

        user_id = uuid.uuid4()
        payload = {
            "sub": str(user_id),
            "email": "es256_patron@example.com",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, priv, algorithm="ES256", headers={"kid": "supabase-es256-kid"})

        class MockSigningKey:
            key = pub

        class MockJWKClient:
            def get_signing_key_from_jwt(self, tok):
                return MockSigningKey()

        monkeypatch.setattr(AuthService, "get_jwk_client", classmethod(lambda cls, url: MockJWKClient()))

        claims = AuthService.verify_token(token)
        assert claims["sub"] == str(user_id)
        assert claims["email"] == "es256_patron@example.com"

    def test_expired_es256_token_rejected_with_401(self, client: TestClient, monkeypatch):
        """Expired ES256 token must be rejected with 401 and 'expired' in detail."""
        from cryptography.hazmat.primitives.asymmetric import ec
        priv = ec.generate_private_key(ec.SECP256R1())
        pub = priv.public_key()

        user_id = uuid.uuid4()
        payload = {
            "sub": str(user_id),
            "email": "expired_es256@example.com",
            "aud": "authenticated",
            "exp": int(time.time()) - 300,
        }
        token = jwt.encode(payload, priv, algorithm="ES256", headers={"kid": "supabase-es256-kid"})

        class MockSigningKey:
            key = pub

        class MockJWKClient:
            def get_signing_key_from_jwt(self, tok):
                return MockSigningKey()

        monkeypatch.setattr(AuthService, "get_jwk_client", classmethod(lambda cls, url: MockJWKClient()))

        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401
        assert "expired" in res.json()["detail"].lower()


class TestCustomerDataIsolationAndLifecycle:
    """Verify customer permissions, order placement, and data boundaries."""

    def test_customer_can_place_and_view_own_order(self, client: TestClient, db_session: Session):
        """Authenticated customer can place an order and see it in their archive."""
        user_id = uuid.uuid4()
        email = f"patron_{user_id.hex[:6]}@example.com"
        token = generate_test_token(user_id=user_id, email=email, name="Active Patron")

        # Create category and product
        cat = Category(name="Living Textiles", slug="living-textiles-test", realm_number="R02", active=True)
        db_session.add(cat)
        db_session.commit()

        prod = Product(
            name="Linen Cushion",
            slug="linen-cushion-test",
            price=3200,
            stock=15,
            active=True,
            category_id=cat.id,
        )
        db_session.add(prod)
        db_session.commit()

        # Place order
        order_payload = {
            "items": [
                {
                    "product_id": str(prod.id),
                    "slug": prod.slug,
                    "product_name": prod.name,
                    "quantity": 2,
                    "unit_price": 3200,
                }
            ],
            "shipping_address": {
                "fullName": "Active Patron",
                "email": email,
                "phone": "+91 9876543210",
                "address": "42 Sea View",
                "city": "Mumbai",
                "state": "Maharashtra",
                "postalCode": "400050",
                "country": "India",
            },
            "delivery_method": "standard",
            "payment_method": "upi",
        }

        res = client.post("/api/v1/orders", headers={"Authorization": f"Bearer {token}"}, json=order_payload)
        assert res.status_code == 201
        created_order = res.json()
        assert float(created_order["total_amount"]) == 6400.0

        # View orders
        res_me = client.get("/api/v1/orders/me", headers={"Authorization": f"Bearer {token}"})
        assert res_me.status_code == 200
        orders = res_me.json()
        assert len(orders) >= 1
        assert orders[0]["order_number"] == created_order["order_number"]

    def test_unauthenticated_guest_cannot_access_private_orders(self, client: TestClient):
        """Unauthenticated requests to /api/v1/orders/me must return 401."""
        res = client.get("/api/v1/orders/me")
        assert res.status_code == 401

    def test_customer_cannot_read_other_customer_order_detail(self, client: TestClient, db_session: Session):
        """Customer B cannot view Customer A's order by order ID."""
        user_a = User(id=uuid.uuid4(), email="user_a@example.com", name="User A", role="customer")
        user_b = User(id=uuid.uuid4(), email="user_b@example.com", name="User B", role="customer")
        db_session.add_all([user_a, user_b])
        db_session.flush()

        order_a = Order(
            order_number="ORD-A-SECRET",
            user_id=user_a.id,
            status="Placed",
            subtotal=Decimal("4000.00"),
            shipping_amount=Decimal("0.00"),
            total_amount=Decimal("4000.00"),
        )
        db_session.add(order_a)
        db_session.commit()

        token_b = generate_test_token(user_id=user_b.id, email=user_b.email)
        res = client.get(f"/api/v1/orders/{order_a.id}", headers={"Authorization": f"Bearer {token_b}"})
        # Customer B is not the owner and not an admin -> 404 or 403
        assert res.status_code in (403, 404)
