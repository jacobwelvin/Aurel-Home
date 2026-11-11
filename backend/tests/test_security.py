"""
Comprehensive security tests for Aurel Home authentication, authorization,
role separation, and data isolation.
"""
import time
import uuid
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.order import Order, OrderItem
from app.core.config import get_settings
from tests.test_auth import generate_test_token, TEST_JWT_SECRET


@pytest.fixture(autouse=True)
def configure_test_jwt(monkeypatch):
    """Ensure SUPABASE_JWT_SECRET is active during security tests."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)


# =========================================================================
# Phase 2: Role Separation — New registrations always get 'customer'
# =========================================================================

class TestRoleSeparation:
    """Verify that new users always receive 'customer' role and cannot self-escalate."""

    def test_new_user_via_auth_me_defaults_to_customer(self, client: TestClient, db_session: Session):
        """A brand-new Supabase user hitting /auth/me gets role='customer'."""
        user_id = uuid.uuid4()
        email = f"new_patron_{user_id.hex[:8]}@example.com"
        token = generate_test_token(user_id=user_id, email=email, name="New Patron")

        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["role"] == "customer"

        # Verify in DB
        user = db_session.query(User).filter(User.id == user_id).first()
        assert user is not None
        assert user.role == "customer"

    def test_new_user_via_sync_defaults_to_customer(self, client: TestClient, db_session: Session):
        """POST /auth/sync for a new user creates them with role='customer'."""
        user_id = uuid.uuid4()
        email = f"sync_patron_{user_id.hex[:8]}@example.com"
        token = generate_test_token(user_id=user_id, email=email)

        res = client.post(
            "/api/v1/auth/sync",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Sync Patron"},
        )
        assert res.status_code == 200
        assert res.json()["role"] == "customer"

    def test_role_field_ignored_in_profile_update(self, client: TestClient, db_session: Session):
        """PATCH /auth/me with role='admin' in body does not change the role."""
        user_id = uuid.uuid4()
        email = "escalation_attempt@example.com"
        token = generate_test_token(user_id=user_id, email=email)

        # First, create user
        client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        # Attempt escalation via PATCH
        res = client.patch(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Escalated", "role": "admin"},
        )
        assert res.status_code == 200
        assert res.json()["role"] == "customer"

    def test_role_field_ignored_in_sync_payload(self, client: TestClient, db_session: Session):
        """POST /auth/sync with role='admin' in body does not change the role."""
        user_id = uuid.uuid4()
        email = "sync_escalation@example.com"
        token = generate_test_token(user_id=user_id, email=email)

        res = client.post(
            "/api/v1/auth/sync",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Hacker", "role": "admin"},
        )
        assert res.status_code == 200
        assert res.json()["role"] == "customer"

    def test_existing_admin_role_preserved_on_resync(self, client: TestClient, db_session: Session):
        """Calling /auth/sync for an existing admin does NOT demote to customer."""
        admin_id = uuid.uuid4()
        email = f"existing_admin_{admin_id.hex[:8]}@aurelhome.com"

        admin = User(id=admin_id, email=email, name="Existing Admin", role="admin")
        db_session.add(admin)
        db_session.commit()

        token = generate_test_token(user_id=admin_id, email=email)
        res = client.post(
            "/api/v1/auth/sync",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Existing Admin Updated"},
        )
        assert res.status_code == 200
        assert res.json()["role"] == "admin"


# =========================================================================
# Phase 1: Admin API Key Vulnerability Removed
# =========================================================================

class TestAdminApiKeyHardening:
    """Verify that the default/empty/weak API key cannot grant admin access."""

    def test_default_api_key_rejected(self, client: TestClient, monkeypatch):
        """The old hardcoded default key must not grant access."""
        monkeypatch.setattr(get_settings(), "ADMIN_API_KEY", "aurel-home-admin-secret-dev")
        res = client.get(
            "/api/v1/admin/dashboard/stats",
            headers={"X-Admin-API-Key": "aurel-home-admin-secret-dev"},
        )
        assert res.status_code == 401

    def test_empty_api_key_rejected(self, client: TestClient, monkeypatch):
        """An empty API key must not grant access."""
        monkeypatch.setattr(get_settings(), "ADMIN_API_KEY", "")
        res = client.get(
            "/api/v1/admin/dashboard/stats",
            headers={"X-Admin-API-Key": ""},
        )
        assert res.status_code == 401

    def test_none_api_key_rejected(self, client: TestClient, monkeypatch):
        """A None API key means the feature is disabled."""
        monkeypatch.setattr(get_settings(), "ADMIN_API_KEY", None)
        res = client.get(
            "/api/v1/admin/dashboard/stats",
            headers={"X-Admin-API-Key": "anything"},
        )
        assert res.status_code == 401

    def test_short_api_key_rejected(self, client: TestClient, monkeypatch):
        """A key shorter than 32 chars must not grant access."""
        short_key = "short-key-only-20chars"
        monkeypatch.setattr(get_settings(), "ADMIN_API_KEY", short_key)
        res = client.get(
            "/api/v1/admin/dashboard/stats",
            headers={"X-Admin-API-Key": short_key},
        )
        assert res.status_code == 401

    def test_wrong_api_key_rejected(self, client: TestClient, db_session: Session, monkeypatch):
        """A wrong key with a valid-length configured key must not grant access."""
        real_key = "this-is-a-valid-high-entropy-key-with-64-chars-for-production!!!"
        monkeypatch.setattr(get_settings(), "ADMIN_API_KEY", real_key)
        res = client.get(
            "/api/v1/admin/dashboard/stats",
            headers={"X-Admin-API-Key": "wrong-key-attempt-that-is-also-long-enough-to-pass-length-check"},
        )
        assert res.status_code == 401

    def test_valid_api_key_requires_admin_in_database(self, client: TestClient, db_session: Session, monkeypatch):
        """A valid API key still fails if no admin user exists in the database."""
        valid_key = "this-is-a-valid-high-entropy-key-with-64-chars-for-production!!!"
        monkeypatch.setattr(get_settings(), "ADMIN_API_KEY", valid_key)

        # Ensure no admin exists (test DB is clean per test)
        res = client.get(
            "/api/v1/admin/dashboard/stats",
            headers={"X-Admin-API-Key": valid_key},
        )
        assert res.status_code == 403
        assert "No administrator account" in res.json()["detail"]

    def test_valid_api_key_with_admin_in_db_succeeds(self, client: TestClient, db_session: Session, monkeypatch):
        """A valid API key with an admin in DB grants access."""
        valid_key = "this-is-a-valid-high-entropy-key-with-64-chars-for-production!!!"
        monkeypatch.setattr(get_settings(), "ADMIN_API_KEY", valid_key)

        admin = User(
            id=uuid.uuid4(),
            email="apikey_admin@aurelhome.com",
            name="API Key Admin",
            role="admin",
        )
        db_session.add(admin)
        db_session.commit()

        res = client.get(
            "/api/v1/admin/dashboard/stats",
            headers={"X-Admin-API-Key": valid_key},
        )
        assert res.status_code == 200


# =========================================================================
# Phase 2 + 4: Customer cannot access admin APIs
# =========================================================================

class TestCustomerCannotAccessAdmin:
    """Verify customers are blocked from every admin endpoint."""

    @pytest.fixture()
    def customer_token(self, db_session: Session):
        cust_id = uuid.uuid4()
        email = "blocked_customer@example.com"
        cust = User(id=cust_id, email=email, name="Blocked Customer", role="customer")
        db_session.add(cust)
        db_session.commit()
        return generate_test_token(user_id=cust_id, email=email)

    def test_customer_blocked_from_dashboard_stats(self, client: TestClient, customer_token):
        res = client.get("/api/v1/admin/dashboard/stats", headers={"Authorization": f"Bearer {customer_token}"})
        assert res.status_code == 403

    def test_customer_blocked_from_recent_orders(self, client: TestClient, customer_token):
        res = client.get("/api/v1/admin/dashboard/recent-orders", headers={"Authorization": f"Bearer {customer_token}"})
        assert res.status_code == 403

    def test_customer_blocked_from_sales_summary(self, client: TestClient, customer_token):
        res = client.get("/api/v1/admin/dashboard/sales-summary", headers={"Authorization": f"Bearer {customer_token}"})
        assert res.status_code == 403

    def test_customer_blocked_from_admin_orders(self, client: TestClient, customer_token):
        res = client.get("/api/v1/admin/orders", headers={"Authorization": f"Bearer {customer_token}"})
        assert res.status_code == 403

    def test_customer_blocked_from_creating_product(self, client: TestClient, customer_token):
        res = client.post(
            "/api/v1/products",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={
                "name": "Exploit Product",
                "slug": "exploit-product",
                "price": 100,
                "stock": 10,
                "active": True,
            },
        )
        assert res.status_code == 403

    def test_customer_blocked_from_creating_category(self, client: TestClient, customer_token):
        res = client.post(
            "/api/v1/categories",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={
                "name": "Exploit Category",
                "slug": "exploit-category",
                "realm_number": "Realm 99",
                "description": "Exploit",
                "image": "/img.jpg",
                "active": True,
            },
        )
        assert res.status_code == 403

    def test_customer_blocked_from_image_upload(self, client: TestClient, customer_token):
        res = client.post(
            "/api/v1/admin/upload-image",
            headers={"Authorization": f"Bearer {customer_token}"},
            files={"file": ("test.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
        )
        assert res.status_code == 403

    def test_customer_blocked_from_updating_category(self, client: TestClient, customer_token, db_session: Session):
        cat = Category(name="Living Realm", slug="living-realm-sec", realm_number="R01", active=True)
        db_session.add(cat)
        db_session.commit()

        res = client.patch(
            f"/api/v1/categories/{cat.id}",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={"name": "Hacked Category"},
        )
        assert res.status_code == 403


# =========================================================================
# Phase 5: Admin retains access
# =========================================================================

class TestAdminRetainsAccess:
    """Verify the existing authorized administrator can still operate."""

    @pytest.fixture()
    def admin_setup(self, db_session: Session):
        admin_id = uuid.uuid4()
        email = "verified_curator@aurelhome.com"
        admin = User(id=admin_id, email=email, name="Verified Curator", role="admin")
        db_session.add(admin)
        db_session.commit()
        token = generate_test_token(user_id=admin_id, email=email, name="Verified Curator")
        return admin, token

    def test_admin_can_view_dashboard(self, client: TestClient, admin_setup):
        _, token = admin_setup
        res = client.get("/api/v1/admin/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200

    def test_admin_can_create_product(self, client: TestClient, admin_setup, db_session: Session):
        _, token = admin_setup
        cat = Category(name="Test Realm", slug="test-realm-sec", realm_number="R01", active=True)
        db_session.add(cat)
        db_session.commit()

        res = client.post(
            "/api/v1/products",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Secure Product",
                "slug": "secure-product-test",
                "price": 5000,
                "stock": 10,
                "active": True,
                "category_id": str(cat.id),
            },
        )
        assert res.status_code == 201

    def test_admin_can_view_orders(self, client: TestClient, admin_setup):
        _, token = admin_setup
        res = client.get("/api/v1/admin/orders", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200

    def test_admin_can_create_category(self, client: TestClient, admin_setup):
        _, token = admin_setup
        res = client.post(
            "/api/v1/categories",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Security Test Category",
                "slug": "security-test-cat",
                "realm_number": "Realm 88",
                "description": "For security tests",
                "image": "/test.jpg",
                "active": True,
            },
        )
        assert res.status_code == 201


# =========================================================================
# Phase 2: Data Isolation — Customer cannot see other customer's data
# =========================================================================

class TestCustomerDataIsolation:
    """Verify customers can only access their own orders."""

    def test_customer_cannot_see_other_customer_orders(self, client: TestClient, db_session: Session):
        """Customer A's orders must not be visible to Customer B."""
        # Create Customer A with an order
        cust_a_id = uuid.uuid4()
        cust_a = User(id=cust_a_id, email="customer_a@example.com", name="Customer A", role="customer")
        db_session.add(cust_a)
        db_session.flush()

        order = Order(
            order_number="ORD-ISOLATION-001",
            user_id=cust_a_id,
            status="Placed",
            subtotal=Decimal("5000.00"),
            shipping_amount=Decimal("0.00"),
            total_amount=Decimal("5000.00"),
        )
        db_session.add(order)
        db_session.commit()

        # Customer B tries to view all orders
        cust_b_id = uuid.uuid4()
        cust_b = User(id=cust_b_id, email="customer_b@example.com", name="Customer B", role="customer")
        db_session.add(cust_b)
        db_session.commit()

        token_b = generate_test_token(user_id=cust_b_id, email="customer_b@example.com")
        res = client.get("/api/v1/orders/me", headers={"Authorization": f"Bearer {token_b}"})
        assert res.status_code == 200
        orders = res.json()
        # Customer B should see zero of Customer A's orders
        order_numbers = [o["order_number"] for o in orders]
        assert "ORD-ISOLATION-001" not in order_numbers


# =========================================================================
# Public storefront access still works
# =========================================================================

class TestPublicStorefrontAccess:
    """Verify public endpoints remain accessible without authentication."""

    def test_public_products_accessible(self, client: TestClient):
        res = client.get("/api/v1/products")
        assert res.status_code == 200

    def test_public_categories_accessible(self, client: TestClient):
        res = client.get("/api/v1/categories")
        assert res.status_code == 200

    def test_health_endpoint_accessible(self, client: TestClient):
        res = client.get("/health")
        assert res.status_code == 200


# =========================================================================
# Unauthenticated access to admin endpoints returns 401
# =========================================================================

class TestUnauthenticatedAdminBlocked:
    """Verify unauthenticated requests to admin endpoints are rejected."""

    def test_no_token_admin_stats_401(self, client: TestClient):
        res = client.get("/api/v1/admin/dashboard/stats")
        assert res.status_code == 401

    def test_no_token_admin_orders_401(self, client: TestClient):
        res = client.get("/api/v1/admin/orders")
        assert res.status_code == 401

    def test_no_token_create_product_401(self, client: TestClient):
        res = client.post("/api/v1/products", json={"name": "x", "slug": "x", "price": 1, "stock": 1})
        assert res.status_code == 401

    def test_no_token_create_category_401(self, client: TestClient):
        res = client.post("/api/v1/categories", json={"name": "x", "slug": "x"})
        assert res.status_code == 401

    def test_no_token_upload_image_401(self, client: TestClient):
        res = client.post(
            "/api/v1/admin/upload-image",
            files={"file": ("test.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
        )
        assert res.status_code == 401
