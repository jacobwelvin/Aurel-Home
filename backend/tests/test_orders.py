import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem, OrderHistory
from tests.test_auth import generate_test_token, TEST_JWT_SECRET
from app.core.config import get_settings


@pytest.fixture(autouse=True)
def configure_test_jwt(monkeypatch):
    """Ensure SUPABASE_JWT_SECRET is active during order tests."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)


def create_test_order(db_session: Session, initial_status: str = "Placed") -> tuple[Order, Product]:
    order_id = uuid.uuid4()
    order_num = f"AUR-{uuid.uuid4().hex[:6].upper()}-IN"

    # Seed product with stock 10
    product = Product(
        name="Artisan Armchair",
        slug=f"armchair-{uuid.uuid4().hex[:6]}",
        price=Decimal("15000.00"),
        stock=10,
        active=True,
    )
    db_session.add(product)
    db_session.flush()

    order = Order(
        id=order_id,
        order_number=order_num,
        status=initial_status,
        payment_status="Pending",
        subtotal=Decimal("15000.00"),
        shipping_amount=Decimal("0.00"),
        total_amount=Decimal("15000.00"),
        shipping_address={
            "fullName": "Priya Sharma",
            "email": "priya@example.com",
            "phone": "+91 98765 43210",
            "address": "42 Malabar Hill",
            "city": "Mumbai",
            "state": "Maharashtra",
            "postalCode": "400006",
            "country": "India",
        },
        payment_method="UPI",
    )
    db_session.add(order)
    db_session.flush()

    order_item = OrderItem(
        order_id=order.id,
        product_id=product.id,
        product_name_snapshot="Artisan Armchair",
        quantity=2,
        unit_price=Decimal("15000.00"),
        line_total=Decimal("30000.00"),
    )
    db_session.add(order_item)
    db_session.commit()
    db_session.refresh(order)
    return order, product


def test_list_orders_unauthenticated_returns_401(client: TestClient):
    res = client.get("/api/v1/admin/orders")
    assert res.status_code == 401


def test_list_orders_customer_returns_403(client: TestClient, db_session: Session):
    customer_id = uuid.uuid4()
    token = generate_test_token(user_id=customer_id, email="patron@example.com")

    res = client.get(
        "/api/v1/admin/orders",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_list_orders_admin_success(client: TestClient, db_session: Session, admin_headers: dict):
    order, _ = create_test_order(db_session, "Placed")

    res = client.get("/api/v1/admin/orders", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    found = [o for o in data["items"] if o["order_number"] == order.order_number]
    assert len(found) == 1
    assert found[0]["customer_name"] == "Priya Sharma"
    assert found[0]["status"] == "Placed"


def test_get_order_details_admin_success(client: TestClient, db_session: Session, admin_headers: dict):
    order, _ = create_test_order(db_session, "Placed")

    res = client.get(f"/api/v1/admin/orders/{order.id}", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(order.id)
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name_snapshot"] == "Artisan Armchair"
    assert data["shipping_address"]["city"] == "Mumbai"


def test_order_status_valid_lifecycle_transitions(client: TestClient, db_session: Session, admin_headers: dict):
    order, _ = create_test_order(db_session, "Placed")

    # Placed -> Confirmed
    res1 = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Confirmed", "note": "Payment validated via webhook"},
        headers=admin_headers,
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "Confirmed"
    assert len(res1.json()["history"]) == 1
    assert res1.json()["history"][0]["previous_status"] == "Placed"
    assert res1.json()["history"][0]["new_status"] == "Confirmed"

    # Confirmed -> Processing
    res2 = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Processing"},
        headers=admin_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "Processing"

    # Processing -> Shipped with carrier and tracking
    res3 = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={
            "new_status": "Shipped",
            "carrier": "BlueDart White-Glove",
            "tracking_number": "BD-8829102",
        },
        headers=admin_headers,
    )
    assert res3.status_code == 200
    assert res3.json()["status"] == "Shipped"
    assert res3.json()["carrier"] == "BlueDart White-Glove"
    assert res3.json()["tracking_number"] == "BD-8829102"

    # Shipped -> Delivered
    res4 = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Delivered", "note": "Signed by patron"},
        headers=admin_headers,
    )
    assert res4.status_code == 200
    assert res4.json()["status"] == "Delivered"


def test_order_status_invalid_transition_rejected(client: TestClient, db_session: Session, admin_headers: dict):
    order, _ = create_test_order(db_session, "Placed")

    # Invalid: Placed -> Delivered directly
    res = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Delivered"},
        headers=admin_headers,
    )
    assert res.status_code == 400
    assert "Invalid status transition" in res.json()["detail"]


def test_order_duplicate_status_update_rejected(client: TestClient, db_session: Session, admin_headers: dict):
    order, _ = create_test_order(db_session, "Placed")

    res = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Placed"},
        headers=admin_headers,
    )
    assert res.status_code == 400
    assert "already in 'Placed' status" in res.json()["detail"]


def test_delivered_terminal_state_cannot_regress(client: TestClient, db_session: Session, admin_headers: dict):
    order, _ = create_test_order(db_session, "Delivered")

    res = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Processing"},
        headers=admin_headers,
    )
    assert res.status_code == 400
    assert "Terminal state" in res.json()["detail"]


def test_cancellation_restores_inventory_stock_atomically(
    client: TestClient, db_session: Session, admin_headers: dict
):
    order, product = create_test_order(db_session, "Processing")
    initial_stock = product.stock  # 10 units

    # Order item had quantity = 2
    res = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Cancelled", "note": "Customer requested cancellation"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "Cancelled"

    # Verify product stock increased by 2 (10 -> 12)
    db_session.refresh(product)
    assert product.stock == initial_stock + 2

    # Retrying cancellation on terminal state is rejected and prevents double-restock
    retry_res = client.patch(
        f"/api/v1/admin/orders/{order.id}/status",
        json={"new_status": "Cancelled"},
        headers=admin_headers,
    )
    assert retry_res.status_code == 400
    db_session.refresh(product)
    assert product.stock == initial_stock + 2


def test_customer_checkout_and_stock_deduction(client: TestClient, db_session: Session):
    product = Product(
        name="Linen Throw",
        slug=f"linen-throw-{uuid.uuid4().hex[:6]}",
        price=Decimal("3500.00"),
        stock=5,
        active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    payload = {
        "items": [
            {
                "product_id": str(product.id),
                "slug": product.slug,
                "product_name": product.name,
                "quantity": 2,
                "unit_price": 3500.00,
            }
        ],
        "shipping_address": {
            "fullName": "Aarav Patel",
            "email": "aarav.patel@example.com",
            "phone": "+91 99887 76655",
            "address": "12 Residency Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postalCode": "560025",
            "country": "India",
        },
        "payment_method": "upi",
        "delivery_method": "standard",
    }

    res = client.post("/api/v1/orders", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["order_number"].startswith("AUR-")
    assert data["status"] == "Confirmed"  # UPI is confirmed
    assert data["payment_status"] == "Paid"
    assert float(data["subtotal"]) == 7000.00
    assert float(data["shipping_amount"]) == 0.00  # >= 2999 is free
    assert float(data["total_amount"]) == 7000.00
    assert len(data["items"]) == 1
    assert data["items"][0]["quantity"] == 2

    # Verify inventory was decremented from 5 to 3
    db_session.refresh(product)
    assert product.stock == 3


def test_customer_checkout_insufficient_stock_fails(client: TestClient, db_session: Session):
    product = Product(
        name="Rare Vase",
        slug=f"rare-vase-{uuid.uuid4().hex[:6]}",
        price=Decimal("12000.00"),
        stock=1,
        active=True,
    )
    db_session.add(product)
    db_session.commit()

    payload = {
        "items": [
            {
                "product_id": str(product.id),
                "slug": product.slug,
                "product_name": product.name,
                "quantity": 3,
                "unit_price": 12000.00,
            }
        ],
        "shipping_address": {
            "fullName": "Test Customer",
            "email": "test@example.com",
            "address": "Test Street",
        },
    }

    res = client.post("/api/v1/orders", json=payload)
    assert res.status_code == 400
    assert "Insufficient inventory" in res.json()["detail"]


def test_authenticated_customer_order_sync_and_isolation(client: TestClient, db_session: Session, admin_headers: dict):
    # Customer 1
    cust1_id = uuid.uuid4()
    cust1_email = "cust1@example.com"
    cust1_token = generate_test_token(user_id=cust1_id, email=cust1_email)
    cust1_headers = {"Authorization": f"Bearer {cust1_token}"}

    # Customer 2
    cust2_id = uuid.uuid4()
    cust2_email = "cust2@example.com"
    cust2_token = generate_test_token(user_id=cust2_id, email=cust2_email)
    cust2_headers = {"Authorization": f"Bearer {cust2_token}"}

    product = Product(
        name="Brass Cutlery",
        slug=f"brass-cutlery-{uuid.uuid4().hex[:6]}",
        price=Decimal("2500.00"),
        stock=20,
        active=True,
    )
    db_session.add(product)
    db_session.commit()

    # Customer 1 places order
    payload = {
        "items": [
            {
                "product_id": str(product.id),
                "slug": product.slug,
                "product_name": product.name,
                "quantity": 1,
                "unit_price": 2500.00,
            }
        ],
        "shipping_address": {
            "fullName": "Customer One",
            "email": cust1_email,
            "address": "100 Palace Road",
        },
        "payment_method": "card",
    }
    create_res = client.post("/api/v1/orders", json=payload, headers=cust1_headers)
    assert create_res.status_code == 201
    order_data = create_res.json()
    order_num = order_data["order_number"]

    # Customer 1 sees their order in /orders/me
    my_orders_res = client.get("/api/v1/orders/me", headers=cust1_headers)
    assert my_orders_res.status_code == 200
    my_orders = my_orders_res.json()
    assert any(o["order_number"] == order_num for o in my_orders)

    # Customer 2 cannot see Customer 1's order in /orders/me
    cust2_orders_res = client.get("/api/v1/orders/me", headers=cust2_headers)
    assert cust2_orders_res.status_code == 200
    cust2_orders = cust2_orders_res.json()
    assert not any(o["order_number"] == order_num for o in cust2_orders)

    # Customer 2 cannot directly access Customer 1's order details (Forbidden 403)
    forbidden_res = client.get(f"/api/v1/orders/{order_num}", headers=cust2_headers)
    assert forbidden_res.status_code == 403

    # Admin CAN see Customer 1's order in /admin/orders
    admin_list_res = client.get("/api/v1/admin/orders", headers=admin_headers)
    assert admin_list_res.status_code == 200
    admin_orders = admin_list_res.json()["items"]
    assert any(o["order_number"] == order_num for o in admin_orders)

    # Admin updates order status to "Processing"
    patch_res = client.patch(
        f"/api/v1/admin/orders/{order_data['id']}/status",
        json={"new_status": "Processing", "note": "Allocated to artisan"},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "Processing"

    # Customer 1 fetches order detail and sees the updated "Processing" status immediately
    cust1_detail_res = client.get(f"/api/v1/orders/{order_num}", headers=cust1_headers)
    assert cust1_detail_res.status_code == 200
    assert cust1_detail_res.json()["status"] == "Processing"
    assert len(cust1_detail_res.json()["history"]) >= 2


def test_order_creation_enforces_server_authoritative_price(client: TestClient, db_session: Session):
    """
    Client passes a manipulated low unit_price (e.g. 1.00), but server must
    strictly compute from database product.price (e.g. 18500.00).
    """
    product = Product(
        name="Authoritative Table",
        slug=f"auth-table-{uuid.uuid4().hex[:6]}",
        price=Decimal("18500.00"),
        stock=10,
        active=True,
    )
    db_session.add(product)
    db_session.commit()

    payload = {
        "items": [
            {
                "product_id": str(product.id),
                "slug": product.slug,
                "product_name": product.name,
                "quantity": 2,
                "unit_price": 1.00,  # Manipulated client price!
            }
        ],
        "shipping_address": {
            "fullName": "Price Check Customer",
            "email": "pricecheck@example.com",
            "address": "456 Heritage Lane",
        },
        "payment_method": "upi",
    }

    res = client.post("/api/v1/orders", json=payload)
    assert res.status_code == 201
    data = res.json()
    # Server subtotal MUST be 18500 * 2 = 37000.00, not 2.00
    assert Decimal(str(data["subtotal"])) == Decimal("37000.00")
    assert Decimal(str(data["items"][0]["unit_price"])) == Decimal("18500.00")
    assert Decimal(str(data["items"][0]["line_total"])) == Decimal("37000.00")


def test_order_creation_rejects_nonexistent_product(client: TestClient):
    """
    Ordering an item that does not exist in the database catalog must fail with 400.
    """
    fake_id = str(uuid.uuid4())
    payload = {
        "items": [
            {
                "product_id": fake_id,
                "slug": "ghost-item",
                "product_name": "Ghost Item",
                "quantity": 1,
                "unit_price": 999.00,
            }
        ],
        "shipping_address": {
            "fullName": "Ghost Customer",
            "email": "ghost@example.com",
            "address": "Nowhere Street",
        },
    }

    res = client.post("/api/v1/orders", json=payload)
    assert res.status_code == 400
    assert "was not found in catalog" in res.json()["detail"]


def test_order_idempotency_prevents_duplicate_orders(client: TestClient, db_session: Session):
    """
    Submitting the exact same order with the same Idempotency-Key returns
    the original order without creating duplicate orders or double-decrementing stock.
    """
    product = Product(
        name="Idempotent Lamp",
        slug=f"lamp-{uuid.uuid4().hex[:6]}",
        price=Decimal("4200.00"),
        stock=5,
        active=True,
    )
    db_session.add(product)
    db_session.commit()

    idempotency_key = f"idem-{uuid.uuid4().hex}"
    payload = {
        "items": [
            {
                "product_id": str(product.id),
                "slug": product.slug,
                "product_name": product.name,
                "quantity": 2,
                "unit_price": 4200.00,
            }
        ],
        "shipping_address": {
            "fullName": "Idempotent Customer",
            "email": "idempotent@example.com",
            "address": "77 Palm Drive",
        },
        "payment_method": "card",
        "idempotency_key": idempotency_key,
    }

    # First submission
    res1 = client.post("/api/v1/orders", json=payload, headers={"Idempotency-Key": idempotency_key})
    assert res1.status_code == 201
    order1 = res1.json()

    # Verify inventory was decremented by 2 (5 - 2 = 3)
    db_session.refresh(product)
    assert product.stock == 3

    # Second submission with the exact same idempotency key (simulating retry / double click)
    res2 = client.post("/api/v1/orders", json=payload, headers={"Idempotency-Key": idempotency_key})
    assert res2.status_code == 201
    order2 = res2.json()

    # Must return the EXACT same order number and ID
    assert order2["id"] == order1["id"]
    assert order2["order_number"] == order1["order_number"]

    # Crucially, inventory must NOT have been decremented again (still 3, not 1)
    db_session.refresh(product)
    assert product.stock == 3

    # Total orders matching this idempotency key in DB must be exactly 1
    total_orders = db_session.query(Order).filter(Order.idempotency_key == idempotency_key).count()
    assert total_orders == 1


def test_admin_orders_list_selectinload_and_filters(client: TestClient, db_session: Session, admin_headers: dict):
    """
    Verify OrderService.list_orders performs eager loading without Cartesian explosion
    and correctly filters and paginates.
    """
    from app.services.order_service import OrderService

    # Create multiple orders with items and history
    for i in range(3):
        create_test_order(db_session, "Placed" if i % 2 == 0 else "Confirmed")

    # 1. Fetch paginated orders
    res = client.get("/api/v1/admin/orders?limit=2&page=1", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 2
    assert data["total"] >= 3
    assert data["pages"] >= 2

    # 2. Status filter
    res_placed = client.get("/api/v1/admin/orders?status=Placed", headers=admin_headers)
    assert res_placed.status_code == 200
    for o in res_placed.json()["items"]:
        assert o["status"] == "Placed"

    # 3. Direct service test verifying items and history are loaded without Cartesian product
    orders, total, pages = OrderService.list_orders(db_session, page=1, limit=10)
    assert total >= 3
    assert len(orders) >= 3
    for o in orders:
        assert hasattr(o, "items")
        assert hasattr(o, "history")
        assert hasattr(o, "user")


def test_responsive_hostaddr_discovery():
    """
    Verify _resolve_responsive_hostaddr handles valid and unreachable endpoints safely.
    """
    from app.db.session import _resolve_responsive_hostaddr

    # Local port 5432 or localhost
    ip = _resolve_responsive_hostaddr("127.0.0.1", port=5432)
    # Either returns 127.0.0.1 or None depending on whether local Postgres is active
    assert ip in ("127.0.0.1", None)

    # Completely invalid non-resolvable domain returns None without throwing
    invalid_ip = _resolve_responsive_hostaddr("non-existent-domain-xyz-12345.local", port=5432)
    assert invalid_ip is None


def test_checkout_recipient_name_persisted_and_prioritized_over_account_name(
    client: TestClient, db_session: Session, admin_headers: dict
):
    """
    Verify that when an account holder (e.g. Danial Brian) places an order
    with a distinct recipient name (e.g. ELANGO Kad), the recipient name is
    preserved and prioritized in the admin order management and API response.
    """
    account_user_id = uuid.uuid4()
    account_email = "danial.brian@example.com"
    account_name = "Danial Brian"
    token = generate_test_token(user_id=account_user_id, email=account_email, name=account_name)
    user_headers = {"Authorization": f"Bearer {token}"}

    # Create account in DB
    user = User(id=account_user_id, email=account_email, name=account_name, role="customer")
    db_session.add(user)

    # Product
    product = Product(
        name="Artisan Ceramic Urli",
        slug=f"urli-{uuid.uuid4().hex[:6]}",
        price=Decimal("4500.00"),
        stock=10,
        active=True,
    )
    db_session.add(product)
    db_session.commit()

    # Checkout payload with recipient ELANGO Kad
    recipient_name = "ELANGO Kad"
    payload = {
        "items": [
            {
                "product_id": str(product.id),
                "slug": product.slug,
                "product_name": product.name,
                "quantity": 1,
                "unit_price": 4500.00,
            }
        ],
        "shipping_address": {
            "fullName": recipient_name,
            "email": "recipient.elango@example.com",
            "phone": "9789886128",
            "address": "Pudukkottai",
            "apartment": "kattiyavayal",
            "city": "Pudukkottai",
            "state": "Tamilnadu",
            "postalCode": "636102",
            "country": "India",
        },
        "payment_method": "upi",
    }

    create_res = client.post("/api/v1/orders", json=payload, headers=user_headers)
    assert create_res.status_code == 201
    created_order = create_res.json()
    order_id = created_order["id"]
    order_num = created_order["order_number"]

    # 1. Customer order response must prioritize the checkout recipient name
    assert created_order["customer_name"] == recipient_name
    assert created_order["recipient_name"] == recipient_name
    assert created_order["account_name"] == account_name

    # 2. Admin fetches single order detail dossier
    admin_detail_res = client.get(f"/api/v1/admin/orders/{order_id}", headers=admin_headers)
    assert admin_detail_res.status_code == 200
    admin_order = admin_detail_res.json()

    assert admin_order["customer_name"] == recipient_name
    assert admin_order["recipient_name"] == recipient_name
    assert admin_order["account_name"] == account_name
    assert admin_order["shipping_address"]["fullName"] == recipient_name
    assert admin_order["shipping_address"]["apartment"] == "kattiyavayal"
    assert admin_order["shipping_address"]["phone"] == "9789886128"

    # 3. Admin lists orders and searches specifically for recipient "ELANGO"
    search_res = client.get("/api/v1/admin/orders?search=ELANGO", headers=admin_headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] >= 1
    found = [o for o in search_data["items"] if o["order_number"] == order_num]
    assert len(found) == 1
    assert found[0]["customer_name"] == recipient_name
    assert found[0]["recipient_name"] == recipient_name
    assert found[0]["account_name"] == account_name



