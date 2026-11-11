import hmac
import hashlib
import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem
from tests.test_auth import generate_test_token, TEST_JWT_SECRET
from app.core.config import get_settings

TEST_RAZORPAY_SECRET = "test_razorpay_secret_key_12345678"


@pytest.fixture(autouse=True)
def configure_razorpay_test_settings(monkeypatch):
    """Set up test JWT and Razorpay test credentials."""
    settings = get_settings()
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_mock_123456")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", TEST_RAZORPAY_SECRET)


def create_customer_pending_order(db_session: Session, user: User) -> tuple[Order, Product]:
    product = Product(
        name="Handcrafted Brass Urli",
        slug=f"brass-urli-{uuid.uuid4().hex[:6]}",
        price=Decimal("4500.00"),
        stock=15,
        active=True,
    )
    db_session.add(product)
    db_session.commit()

    order = Order(
        order_number=f"AUR-{uuid.uuid4().hex[:4].upper()}-IN",
        user_id=user.id,
        status="Placed",
        payment_status="Pending",
        subtotal=Decimal("4500.00"),
        shipping_amount=Decimal("0.00"),
        total_amount=Decimal("4500.00"),
        shipping_address={
            "fullName": user.name or "Patron",
            "email": user.email,
            "phone": "+91 98765 00000",
            "address": "15 Heritage Court",
            "city": "Jaipur",
            "state": "Rajasthan",
            "postalCode": "302001",
            "country": "India",
        },
        payment_method="upi",
    )
    db_session.add(order)
    db_session.flush()

    item = OrderItem(
        order_id=order.id,
        product_id=product.id,
        product_name_snapshot=product.name,
        quantity=1,
        unit_price=Decimal("4500.00"),
        line_total=Decimal("4500.00"),
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(order)
    return order, product


def test_razorpay_create_order_calculates_server_authoritative_amount(client: TestClient, db_session: Session):
    user_id = uuid.uuid4()
    email = "patron.rzp@example.com"
    token = generate_test_token(user_id=user_id, email=email)
    headers = {"Authorization": f"Bearer {token}"}

    # Ensure user exists in DB
    user = User(id=user_id, email=email, name="Patron Rzp", role="customer")
    db_session.add(user)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user)

    # Call endpoint to generate Razorpay order
    res = client.post(f"/api/v1/orders/{order.id}/razorpay/create-order", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["order_id"] == str(order.id)
    assert data["order_number"] == order.order_number
    assert data["amount"] == 450000  # ₹4500.00 in paise
    assert data["currency"] == "INR"
    assert data["key_id"] == "rzp_test_mock_123456"
    assert data["razorpay_order_id"].startswith("order_test_")
    assert data["customer_email"] == email

    # Verify Razorpay order ID is saved on the order record
    db_session.refresh(order)
    assert order.razorpay_order_id == data["razorpay_order_id"]
    assert order.payment_status == "Pending"  # Still pending until signature verified


def test_razorpay_verify_valid_signature_marks_order_paid(client: TestClient, db_session: Session, admin_headers: dict):
    user_id = uuid.uuid4()
    email = "patron.verify@example.com"
    token = generate_test_token(user_id=user_id, email=email)
    headers = {"Authorization": f"Bearer {token}"}

    user = User(id=user_id, email=email, name="Patron Verify", role="customer")
    db_session.add(user)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user)

    # 1. Initialize Razorpay order
    create_res = client.post(f"/api/v1/orders/{order.id}/razorpay/create-order", headers=headers)
    assert create_res.status_code == 200
    rzp_order_id = create_res.json()["razorpay_order_id"]

    # 2. Generate valid HMAC SHA256 signature
    rzp_payment_id = f"pay_test_{uuid.uuid4().hex[:12]}"
    payload = f"{rzp_order_id}|{rzp_payment_id}"
    valid_signature = hmac.new(
        TEST_RAZORPAY_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # 3. Verify payment signature
    verify_payload = {
        "order_id": str(order.id),
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": valid_signature,
    }
    verify_res = client.post("/api/v1/orders/razorpay/verify", json=verify_payload, headers=headers)
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["success"] is True

    updated_order = verify_data["order"]
    assert updated_order["payment_status"] == "Paid"
    assert updated_order["status"] == "Confirmed"
    assert updated_order["payment_reference"] == rzp_payment_id
    assert updated_order["razorpay_order_id"] == rzp_order_id
    assert updated_order["razorpay_payment_id"] == rzp_payment_id

    # 4. Check DB state
    db_session.refresh(order)
    assert order.payment_status == "Paid"
    assert order.status == "Confirmed"
    assert order.payment_reference == rzp_payment_id
    assert len(order.history) >= 1
    assert any("Razorpay test payment verified" in h.note for h in order.history)

    # 5. Check Admin Orders View displays order with payment_status = Paid
    admin_list_res = client.get("/api/v1/admin/orders", headers=admin_headers)
    assert admin_list_res.status_code == 200
    admin_orders = admin_list_res.json()["items"]
    matching_admin_order = next(o for o in admin_orders if o["order_number"] == order.order_number)
    assert matching_admin_order["payment_status"] == "Paid"


def test_razorpay_verify_invalid_signature_rejected_400(client: TestClient, db_session: Session):
    user_id = uuid.uuid4()
    email = "patron.tamper@example.com"
    token = generate_test_token(user_id=user_id, email=email)
    headers = {"Authorization": f"Bearer {token}"}

    user = User(id=user_id, email=email, name="Patron Tamper", role="customer")
    db_session.add(user)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user)

    # Initialize order
    create_res = client.post(f"/api/v1/orders/{order.id}/razorpay/create-order", headers=headers)
    assert create_res.status_code == 200
    rzp_order_id = create_res.json()["razorpay_order_id"]

    # Deliberately invalid signature
    fake_signature = "bad_signature_0000000000000000000000000000000000000000000000000000"
    verify_payload = {
        "order_id": str(order.id),
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": "pay_fake_99999",
        "razorpay_signature": fake_signature,
    }
    verify_res = client.post("/api/v1/orders/razorpay/verify", json=verify_payload, headers=headers)
    assert verify_res.status_code == 400
    assert "Invalid Razorpay payment signature" in verify_res.json()["detail"]

    # Order must remain Pending
    db_session.refresh(order)
    assert order.payment_status == "Pending"
    assert order.status == "Placed"


def test_razorpay_verify_idempotency(client: TestClient, db_session: Session):
    user_id = uuid.uuid4()
    email = "patron.idem@example.com"
    token = generate_test_token(user_id=user_id, email=email)
    headers = {"Authorization": f"Bearer {token}"}

    user = User(id=user_id, email=email, name="Patron Idem", role="customer")
    db_session.add(user)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user)

    create_res = client.post(f"/api/v1/orders/{order.id}/razorpay/create-order", headers=headers)
    rzp_order_id = create_res.json()["razorpay_order_id"]
    rzp_payment_id = f"pay_test_{uuid.uuid4().hex[:12]}"
    payload = f"{rzp_order_id}|{rzp_payment_id}"
    sig = hmac.new(TEST_RAZORPAY_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()

    verify_payload = {
        "order_id": str(order.id),
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": sig,
    }

    # First call
    res1 = client.post("/api/v1/orders/razorpay/verify", json=verify_payload, headers=headers)
    assert res1.status_code == 200

    # Second call (replay)
    res2 = client.post("/api/v1/orders/razorpay/verify", json=verify_payload, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["order"]["payment_status"] == "Paid"


def test_razorpay_cancellation_preserves_pending_status(client: TestClient, db_session: Session):
    user_id = uuid.uuid4()
    email = "patron.cancel@example.com"
    token = generate_test_token(user_id=user_id, email=email)
    headers = {"Authorization": f"Bearer {token}"}

    user = User(id=user_id, email=email, name="Patron Cancel", role="customer")
    db_session.add(user)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user)

    cancel_res = client.post(
        "/api/v1/orders/razorpay/cancel",
        json={"order_id": str(order.id), "reason": "Customer dismissed Razorpay checkout"},
        headers=headers,
    )
    assert cancel_res.status_code == 200
    data = cancel_res.json()
    assert data["payment_status"] == "Pending"
    assert data["status"] == "Placed"

    db_session.refresh(order)
    assert order.payment_status == "Pending"
    assert any("Razorpay payment attempt aborted" in h.note for h in order.history)


def test_customer_isolation_rejects_unauthorized_payment_operations(client: TestClient, db_session: Session):
    # Customer 1
    cust1_id = uuid.uuid4()
    cust1_email = "cust1.rzp@example.com"
    token1 = generate_test_token(user_id=cust1_id, email=cust1_email)
    user1 = User(id=cust1_id, email=cust1_email, name="Customer 1", role="customer")
    db_session.add(user1)

    # Customer 2
    cust2_id = uuid.uuid4()
    cust2_email = "cust2.rzp@example.com"
    token2 = generate_test_token(user_id=cust2_id, email=cust2_email)
    user2 = User(id=cust2_id, email=cust2_email, name="Customer 2", role="customer")
    db_session.add(user2)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user1)

    # Customer 2 attempts to initialize Razorpay for Customer 1's order -> 403 Forbidden
    hack_res = client.post(
        f"/api/v1/orders/{order.id}/razorpay/create-order",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert hack_res.status_code == 403
    assert "Forbidden" in hack_res.json()["detail"]


def test_webhook_unconfigured_secret_returns_503_gracefully(client: TestClient, monkeypatch):
    """
    When RAZORPAY_WEBHOOK_SECRET is unconfigured (None),
    the webhook returns 503 Service Unavailable without crashing or blocking the app.
    """
    settings = get_settings()
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", None)

    res = client.post(
        "/api/v1/orders/razorpay/webhook",
        content=b'{"event": "order.paid"}',
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "dummy_sig"},
    )
    assert res.status_code == 503
    assert "RAZORPAY_WEBHOOK_SECRET is unconfigured" in res.json()["detail"]


def test_webhook_invalid_signature_rejected_400(client: TestClient, monkeypatch):
    """
    When RAZORPAY_WEBHOOK_SECRET is set, invalid X-Razorpay-Signature is rejected with 400.
    """
    settings = get_settings()
    webhook_secret = "test_webhook_secret_key_8888"
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", webhook_secret)

    raw_body = b'{"event": "order.paid", "payload": {}}'
    bad_signature = "bad_hex_signature_0000000000000000000000000000000000000000000000"

    res = client.post(
        "/api/v1/orders/razorpay/webhook",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": bad_signature},
    )
    assert res.status_code == 400
    assert "Invalid Razorpay webhook signature" in res.json()["detail"]


def test_webhook_order_paid_updates_database_idempotently(client: TestClient, db_session: Session, monkeypatch):
    """
    Valid webhook with event order.paid transitions order from Pending to Paid,
    sets payment_reference, and is idempotent upon duplicate deliveries.
    """
    import json
    settings = get_settings()
    webhook_secret = "test_webhook_secret_key_8888"
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", webhook_secret)

    user_id = uuid.uuid4()
    email = "webhook.patron@example.com"
    user = User(id=user_id, email=email, name="Webhook Patron", role="customer")
    db_session.add(user)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user)
    rzp_order_id = f"order_{uuid.uuid4().hex[:14]}"
    order.razorpay_order_id = rzp_order_id
    db_session.commit()

    rzp_payment_id = f"pay_{uuid.uuid4().hex[:14]}"
    webhook_payload = {
        "event": "order.paid",
        "payload": {
            "order": {
                "entity": {
                    "id": rzp_order_id,
                    "receipt": order.order_number,
                    "amount": 450000,
                    "status": "paid",
                }
            },
            "payment": {
                "entity": {
                    "id": rzp_payment_id,
                    "order_id": rzp_order_id,
                    "amount": 450000,
                    "status": "captured",
                }
            },
        },
    }
    raw_body = json.dumps(webhook_payload).encode("utf-8")
    valid_signature = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": valid_signature,
    }

    # 1. First webhook delivery
    res1 = client.post("/api/v1/orders/razorpay/webhook", content=raw_body, headers=headers)
    assert res1.status_code == 200
    assert res1.json()["status"] == "ok"
    assert res1.json()["order_number"] == order.order_number

    # Verify database state
    db_session.refresh(order)
    assert order.payment_status == "Paid"
    assert order.status == "Confirmed"
    assert order.payment_reference == rzp_payment_id
    assert order.razorpay_payment_id == rzp_payment_id
    assert any("Payment confirmed via Razorpay webhook" in h.note for h in order.history)

    # 2. Duplicate webhook delivery (idempotency check)
    res2 = client.post("/api/v1/orders/razorpay/webhook", content=raw_body, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "ok"
    assert "already marked as Paid" in res2.json()["message"]


def test_webhook_payment_failed_logs_audit_history(client: TestClient, db_session: Session, monkeypatch):
    """
    Webhook payment.failed event logs failure in history without falsely marking order as Paid.
    """
    import json
    settings = get_settings()
    webhook_secret = "test_webhook_secret_key_8888"
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", webhook_secret)

    user_id = uuid.uuid4()
    email = "fail.patron@example.com"
    user = User(id=user_id, email=email, name="Fail Patron", role="customer")
    db_session.add(user)
    db_session.commit()

    order, product = create_customer_pending_order(db_session, user)
    rzp_order_id = f"order_{uuid.uuid4().hex[:14]}"
    order.razorpay_order_id = rzp_order_id
    db_session.commit()

    webhook_payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_failed_{uuid.uuid4().hex[:8]}",
                    "order_id": rzp_order_id,
                    "error_description": "Bank servers declined authorization",
                }
            }
        },
    }
    raw_body = json.dumps(webhook_payload).encode("utf-8")
    valid_signature = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": valid_signature,
    }

    res = client.post("/api/v1/orders/razorpay/webhook", content=raw_body, headers=headers)
    assert res.status_code == 200

    db_session.refresh(order)
    # Order must remain Pending
    assert order.payment_status == "Pending"
    assert any("Bank servers declined authorization" in (h.note or "") for h in order.history)

