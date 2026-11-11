import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.db.session import get_engine, get_db
from app.core.config import get_settings


@pytest.fixture(scope="module")
def live_client():
    """
    TestClient that uses the actual PostgreSQL engine and database session
    (WITHOUT overriding get_db to in-memory SQLite).
    """
    with TestClient(app) as client:
        yield client


def test_live_health_endpoint(live_client: TestClient):
    """Verify GET /health against live Supabase PostgreSQL."""
    response = live_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"]["status"] == "connected"
    assert data["database"]["connected"] is True
    assert "Database ping successful" in data["database"]["message"]


def test_live_root_endpoint(live_client: TestClient):
    """Verify GET / root endpoint."""
    response = live_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Aurel Home API" in data["message"]
    assert data["docs"] == "/docs"


def test_live_categories_read(live_client: TestClient):
    """Verify GET /api/v1/categories queries live PostgreSQL."""
    response = live_client.get("/api/v1/categories")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_live_products_read_and_pagination(live_client: TestClient):
    """Verify GET /api/v1/products queries live PostgreSQL with pagination & filtering."""
    response = live_client.get("/api/v1/products?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1
    assert data["limit"] == 10

    # Search filter against live PostgreSQL
    search_res = live_client.get("/api/v1/products?search=Atelier")
    assert search_res.status_code == 200


def test_live_nonexistent_product_404(live_client: TestClient):
    """Verify querying non-existent UUID returns safe 404 from live PostgreSQL."""
    fake_id = str(uuid.uuid4())
    response = live_client.get(f"/api/v1/products/{fake_id}")
    assert response.status_code == 404
    assert f"Product with ID '{fake_id}' was not found." in response.json()["detail"]


def test_live_nonexistent_category_404(live_client: TestClient):
    """Verify querying non-existent category UUID returns safe 404 from live PostgreSQL."""
    fake_id = str(uuid.uuid4())
    response = live_client.get(f"/api/v1/categories/{fake_id}")
    assert response.status_code == 404
    assert f"Category with ID '{fake_id}' not found." in response.json()["detail"]


def test_live_invalid_uuid_validation(live_client: TestClient):
    """Verify invalid UUID parameter format produces safe 422 error."""
    response = live_client.get("/api/v1/products/not-a-valid-uuid")
    assert response.status_code == 422


def test_live_write_protection_unauthorized(live_client: TestClient):
    """
    Verify that write operations cannot modify live Supabase PostgreSQL
    without the required administrative authorization header.
    """
    fake_id = str(uuid.uuid4())

    # Create product without auth
    res_create = live_client.post("/api/v1/products", json={"name": "Test", "slug": "test", "price": 100})
    assert res_create.status_code == 401

    # Update product without auth
    res_update = live_client.patch(f"/api/v1/products/{fake_id}", json={"price": 200})
    assert res_update.status_code == 401

    # Delete product without auth
    res_delete = live_client.delete(f"/api/v1/products/{fake_id}")
    assert res_delete.status_code == 401

    # Create category without auth
    res_cat = live_client.post("/api/v1/categories", json={"name": "Test Cat", "slug": "test-cat"})
    assert res_cat.status_code == 401


def test_live_isolated_transactional_write_and_rollback():
    """
    Test write path against live PostgreSQL using an isolated transaction
    that is explicitly rolled back to guarantee zero persistent data is committed.
    """
    from app.services.category_service import CategoryService
    from app.schemas.category import CategoryCreate

    engine = get_engine()
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    try:
        test_slug = f"live-test-cat-{uuid.uuid4().hex[:6]}"
        cat_in = CategoryCreate(
            name="Live Transaction Test Realm",
            slug=test_slug,
            realm_number="Realm Test",
            description="Testing live write path with guaranteed rollback",
        )
        # Verify creation logic on PostgreSQL
        created = CategoryService.create_category(db=session, category_in=cat_in)
        assert created.id is not None
        assert created.slug == test_slug

        # Verify query on PostgreSQL within same transaction
        retrieved = CategoryService.get_by_id(db=session, category_id=created.id)
        assert retrieved.name == "Live Transaction Test Realm"
    finally:
        # Guarantee rollback so live database remains clean
        transaction.rollback()
        session.close()
        connection.close()

    # Verify that the test record does NOT exist in live database
    with engine.connect() as verify_conn:
        from sqlalchemy import text
        count = verify_conn.execute(
            text(f"SELECT COUNT(*) FROM categories WHERE slug = '{test_slug}'")
        ).scalar()
        assert count == 0


def test_live_recipient_name_mapping_for_existing_order():
    """
    Verify that existing order in live PostgreSQL (AUR-9121-IN) maps
    the checkout recipient name (ELANGO Kad) rather than being overwritten
    by the account profile name (Danial Brian).
    """
    from app.services.order_service import OrderService
    from app.api.routes.orders import _map_order_response
    from app.models.user import User
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        admin_sim = User(role="admin")
        order = OrderService.get_customer_order(db, "AUR-9121-IN", user=admin_sim)
        mapped = _map_order_response(order)
        assert mapped.recipient_name == "ELANGO Kad"
        assert mapped.customer_name == "ELANGO Kad"
        assert mapped.account_name == "Danial Brian"
        assert mapped.shipping_address["fullName"] == "ELANGO Kad"
        assert mapped.shipping_address["apartment"] == "kattiyavayal"
        assert mapped.shipping_address["phone"] == "9789886128"
    finally:
        db.close()

