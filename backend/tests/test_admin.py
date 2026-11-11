import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.order import Order, OrderItem
from tests.test_auth import generate_test_token, TEST_JWT_SECRET
from app.core.config import get_settings


@pytest.fixture(autouse=True)
def configure_test_jwt(monkeypatch):
    """Ensure SUPABASE_JWT_SECRET is active during admin tests."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)


def test_unauthenticated_admin_stats_returns_401(client: TestClient):
    """Calling admin stats without token returns 401."""
    res = client.get("/api/v1/admin/dashboard/stats")
    assert res.status_code == 401


def test_customer_forbidden_from_admin_stats(client: TestClient, db_session: Session):
    """Customer role receives 403 Forbidden on dashboard stats."""
    customer_id = uuid.uuid4()
    email = "customer_denied@example.com"
    token = generate_test_token(user_id=customer_id, email=email)

    res = client.get(
        "/api/v1/admin/dashboard/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_admin_authorized_for_admin_stats_with_accurate_aggregation(
    client: TestClient, db_session: Session
):
    """Admin receives 200 OK and accurate aggregated figures."""
    admin_id = uuid.uuid4()
    email = "admin_verified@aurelhome.com"
    admin_user = User(
        id=admin_id,
        email=email,
        name="Lead Administrator",
        role="admin",
    )
    db_session.add(admin_user)

    # Seed a category
    category = Category(
        name="Atelier Seating",
        slug="atelier-seating",
        realm_number="Realm 01",
        active=True,
    )
    db_session.add(category)
    db_session.flush()

    # Seed 2 products (1 normal stock, 1 low stock)
    p1 = Product(
        name="Lounge Chair",
        slug="lounge-chair",
        price=Decimal("12000.00"),
        stock=12,
        active=True,
        category_id=category.id,
    )
    p2 = Product(
        name="Carved Stool",
        slug="carved-stool",
        price=Decimal("4500.00"),
        stock=3,  # <= 5 (low stock)
        active=True,
        category_id=category.id,
    )
    db_session.add_all([p1, p2])

    # Seed an order
    order = Order(
        order_number="ORD-TEST-001",
        user_id=admin_id,
        status="Placed",
        subtotal=Decimal("16500.00"),
        shipping_amount=Decimal("0.00"),
        total_amount=Decimal("16500.00"),
    )
    db_session.add(order)
    db_session.commit()

    token = generate_test_token(user_id=admin_id, email=email, name="Lead Administrator")

    res = client.get(
        "/api/v1/admin/dashboard/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_orders"] == 1
    assert data["total_revenue"] == 16500.0
    assert data["total_active_products"] == 2
    assert data["low_stock_products"] == 1
    assert data["low_stock_threshold"] == 5
    assert data["total_categories"] == 1


def test_unauthenticated_recent_orders_returns_401(client: TestClient):
    """Calling recent orders without token returns 401."""
    res = client.get("/api/v1/admin/dashboard/recent-orders")
    assert res.status_code == 401


def test_customer_forbidden_from_recent_orders(client: TestClient):
    """Customer role receives 403 Forbidden on recent orders."""
    token = generate_test_token(user_id=uuid.uuid4(), email="patron@domain.com")
    res = client.get(
        "/api/v1/admin/dashboard/recent-orders",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_admin_can_fetch_recent_orders(client: TestClient, db_session: Session):
    """Admin receives 200 and formatted order records."""
    admin_id = uuid.uuid4()
    email = "admin_orders@aurelhome.com"
    admin_user = User(
        id=admin_id,
        email=email,
        name="Admin User",
        role="admin",
    )
    db_session.add(admin_user)

    order = Order(
        order_number="ORD-AUREL-99",
        user_id=admin_id,
        status="Processing",
        subtotal=Decimal("8900.00"),
        shipping_amount=Decimal("500.00"),
        total_amount=Decimal("9400.00"),
    )
    db_session.add(order)
    db_session.flush()

    item = OrderItem(
        order_id=order.id,
        product_name_snapshot="Flax Linen Pillow",
        quantity=2,
        unit_price=Decimal("4450.00"),
        line_total=Decimal("8900.00"),
    )
    db_session.add(item)
    db_session.commit()

    token = generate_test_token(user_id=admin_id, email=email)

    res = client.get(
        "/api/v1/admin/dashboard/recent-orders",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    orders = res.json()
    assert len(orders) >= 1
    first = orders[0]
    assert first["order_number"] == "ORD-AUREL-99"
    assert first["status"] == "Processing"
    assert first["total_amount"] == 9400.0
    assert first["customer_email"] == email
    assert first["items_count"] == 2


def test_admin_sales_summary_empty_and_populated(client: TestClient, db_session: Session):
    """Admin can fetch sales summary metrics gracefully."""
    admin_id = uuid.uuid4()
    email = "admin_sales@aurelhome.com"
    admin_user = User(
        id=admin_id,
        email=email,
        role="admin",
    )
    db_session.add(admin_user)
    db_session.commit()

    token = generate_test_token(user_id=admin_id, email=email)

    # Empty database state
    res = client.get(
        "/api/v1/admin/dashboard/sales-summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    summary = res.json()
    assert summary["orders_count"] == 0
    assert summary["total_revenue"] == 0.0
    assert summary["average_order_value"] == 0.0
    assert summary["has_data"] is False


def test_promote_admin_script_nonexistent_user(monkeypatch):
    """promote_admin script safely handles nonexistent user and returns 1."""
    from app.scripts.promote_admin import promote_user
    from tests.conftest import TestingSessionLocal

    monkeypatch.setattr("app.scripts.promote_admin.get_session_factory", lambda: TestingSessionLocal)
    exit_code = promote_user("nobody@example.com")
    assert exit_code == 1


def test_promote_admin_script_promotes_and_demotes_existing_user(monkeypatch, db_session: Session):
    """promote_admin script successfully transitions role from customer to admin and back."""
    from app.scripts.promote_admin import promote_user
    from tests.conftest import TestingSessionLocal

    monkeypatch.setattr("app.scripts.promote_admin.get_session_factory", lambda: TestingSessionLocal)

    user_id = uuid.uuid4()
    email = "patron_to_promote@example.com"
    user = User(
        id=user_id,
        email=email,
        name="Patron Candidate",
        role="customer",
    )
    db_session.add(user)
    db_session.commit()

    # Promote to admin
    code_promote = promote_user(email)
    assert code_promote == 0

    db_session.refresh(user)
    assert user.role == "admin"

    # Verify check_only mode
    code_check = promote_user(email, check_only=True)
    assert code_check == 0

    # Demote back to customer
    code_demote = promote_user(email, demote=True)
    assert code_demote == 0

    db_session.refresh(user)
    assert user.role == "customer"


def test_admin_upload_image_unauthorized(client: TestClient):
    """Uploading without authentication returns 401."""
    res = client.post(
        "/api/v1/admin/upload-image",
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\nfakecontent", "image/png")},
    )
    assert res.status_code == 401


def test_admin_upload_image_customer_forbidden(client: TestClient, db_session: Session):
    """Customer role cannot upload images."""
    customer_id = uuid.uuid4()
    email = "cust_uploader@example.com"
    token = generate_test_token(user_id=customer_id, email=email)

    res = client.post(
        "/api/v1/admin/upload-image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\nfakecontent", "image/png")},
    )
    assert res.status_code == 403


def test_admin_upload_image_invalid_type(client: TestClient, db_session: Session):
    """Uploading non-image MIME type returns 400 Bad Request."""
    admin_id = uuid.uuid4()
    email = "admin_uploader@aurelhome.com"
    admin = User(id=admin_id, email=email, name="Admin", role="admin")
    db_session.add(admin)
    db_session.commit()
    token = generate_test_token(user_id=admin_id, email=email)

    res = client.post(
        "/api/v1/admin/upload-image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.txt", b"plain text content", "text/plain")},
    )
    assert res.status_code == 400
    assert "Unsupported image type" in res.json()["detail"]


def test_admin_upload_image_too_large(client: TestClient, db_session: Session):
    """Uploading file exceeding 10MB returns 413."""
    admin_id = uuid.uuid4()
    email = "admin_uploader2@aurelhome.com"
    admin = User(id=admin_id, email=email, name="Admin", role="admin")
    db_session.add(admin)
    db_session.commit()
    token = generate_test_token(user_id=admin_id, email=email)

    large_content = b"0" * (10 * 1024 * 1024 + 1)
    res = client.post(
        "/api/v1/admin/upload-image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("big.png", large_content, "image/png")},
    )
    assert res.status_code == 413
    assert "10MB limit" in res.json()["detail"]


def test_admin_upload_image_success(client: TestClient, db_session: Session):
    """Admin successfully uploads valid image and gets relative static path."""
    admin_id = uuid.uuid4()
    email = "admin_uploader3@aurelhome.com"
    admin = User(id=admin_id, email=email, name="Admin", role="admin")
    db_session.add(admin)
    db_session.commit()
    token = generate_test_token(user_id=admin_id, email=email)

    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    res = client.post(
        "/api/v1/admin/upload-image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("sample.png", fake_png, "image/png")},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["url"].startswith("/static/uploads/")
    assert data["content_type"] == "image/png"
    assert data["size"] == len(fake_png)
    assert data["filename"].endswith(".png")

