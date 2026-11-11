import uuid
import hmac
import hashlib
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.category import Category
from app.models.order import Order
from app.models.user import User
from tests.test_auth import generate_test_token, TEST_JWT_SECRET
from app.core.config import get_settings


def make_razorpay_sig(rzp_order_id: str, rzp_payment_id: str) -> str:
    secret = get_settings().RAZORPAY_KEY_SECRET or "test_secret"
    payload = f"{rzp_order_id}|{rzp_payment_id}"
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


@pytest.fixture(autouse=True)
def configure_test_jwt(monkeypatch):
    """Ensure SUPABASE_JWT_SECRET is active during order tests."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)


@pytest.fixture
def test_setup_data(db_session: Session):
    """Seed category, product, customer, and other customer for test assertions."""
    cat = Category(
        name="Artisanal Linens",
        slug="artisanal-linens",
        description="Heritage weaves",
        active=True,
    )
    db_session.add(cat)
    db_session.flush()

    prod = Product(
        category_id=cat.id,
        name="Embroidered Linen Cushion",
        slug="embroidered-linen-cushion",
        description="Pure Belgian linen",
        price=Decimal("1200.00"),
        stock=50,
        images=["/images/cushion.jpg"],
    )
    db_session.add(prod)

    # Customer 1 (Owner)
    owner = User(
        email="patron.elango@aurelhome.com",
        name="Elango Kad",
        role="customer",
    )
    # Customer 2 (Attacker / Different Customer)
    other_patron = User(
        email="other.patron@aurelhome.com",
        name="Other Patron",
        role="customer",
    )
    # Admin
    admin_user = User(
        email="concierge.admin@aurelhome.com",
        name="Admin Atelier",
        role="admin",
    )
    db_session.add_all([owner, other_patron, admin_user])
    db_session.commit()
    db_session.refresh(prod)
    db_session.refresh(owner)
    db_session.refresh(other_patron)
    db_session.refresh(admin_user)

    return {
        "product": prod,
        "owner": owner,
        "other_patron": other_patron,
        "admin": admin_user,
    }


def test_1_customer_places_cod_order_payment_pending(client: TestClient, test_setup_data):
    """Flow 1: Customer places a COD order; payment status is Pending, method is cod."""
    owner = test_setup_data["owner"]
    prod = test_setup_data["product"]
    token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")

    payload = {
        "items": [
            {
                "product_id": str(prod.id),
                "product_name": prod.name,
                "quantity": 2,
                "unit_price": float(prod.price),
            }
        ],
        "shipping_address": {
            "fullName": "Elango Kad",
            "email": owner.email,
            "phone": "+91 9876543210",
            "address": "42 Marine Drive",
            "city": "Mumbai",
            "state": "Maharashtra",
            "postalCode": "400020",
        },
        "payment_method": "cod",
        "delivery_method": "standard",
    }

    res = client.post(
        "/api/v1/orders",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["payment_method"] == "cod"
    assert data["payment_status"] == "Pending"
    assert data["status"] == "Placed"
    assert float(data["total_amount"]) > 0


def test_2_customer_pays_existing_cod_order_online(client: TestClient, db_session: Session, test_setup_data):
    """Flow 2: Customer pays existing COD order online via Razorpay test mode; the same order becomes paid."""
    owner = test_setup_data["owner"]
    prod = test_setup_data["product"]
    token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")

    # 1. Place COD order
    order_payload = {
        "items": [{"product_id": str(prod.id), "product_name": prod.name, "quantity": 1, "unit_price": float(prod.price)}],
        "shipping_address": {
            "fullName": "Elango Kad",
            "email": owner.email,
            "phone": "+91 9876543210",
            "address": "42 Marine Drive",
            "city": "Mumbai",
            "state": "Maharashtra",
            "postalCode": "400020",
        },
        "payment_method": "cod",
        "delivery_method": "standard",
    }
    create_res = client.post("/api/v1/orders", json=order_payload, headers={"Authorization": f"Bearer {token}"})
    assert create_res.status_code == 201
    order_data = create_res.json()
    order_id = order_data["id"]
    order_number = order_data["order_number"]

    # 2. Customer clicks "Pay Online" -> create Razorpay test order
    rzp_res = client.post(
        f"/api/v1/orders/{order_id}/razorpay/create-order",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rzp_res.status_code == 200, rzp_res.text
    rzp_info = rzp_res.json()
    assert rzp_info["order_id"] == order_id
    assert rzp_info["amount"] == int(round(float(order_data["total_amount"]) * 100))
    rzp_order_id = rzp_info["razorpay_order_id"]

    # 3. Customer completes test payment & frontend verifies
    rzp_payment_id = f"pay_test_{uuid.uuid4().hex[:12]}"
    test_sig = make_razorpay_sig(rzp_order_id, rzp_payment_id)

    verify_res = client.post(
        "/api/v1/orders/razorpay/verify",
        json={
            "order_id": order_id,
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "razorpay_signature": test_sig,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert verify_res.status_code == 200, verify_res.text
    verify_data = verify_res.json()
    assert verify_data["success"] is True

    # Check same order was updated, not duplicated
    updated_order = verify_data["order"]
    assert updated_order["id"] == order_id
    assert updated_order["order_number"] == order_number
    assert updated_order["payment_status"] == "Paid"
    assert updated_order["original_payment_method"] == "cod"
    assert updated_order["payment_method"] == "upi"
    assert updated_order["razorpay_payment_id"] == rzp_payment_id
    assert updated_order["paid_at"] is not None


def test_3_admin_sees_verified_payment_information(client: TestClient, db_session: Session, test_setup_data):
    """Flow 3: Admin order view displays the verified payment information and indicates COD was paid online."""
    owner = test_setup_data["owner"]
    admin = test_setup_data["admin"]
    prod = test_setup_data["product"]
    cust_token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")
    admin_token = generate_test_token(user_id=admin.id, email=admin.email, role="admin")

    # Place COD and pay online
    order_res = client.post("/api/v1/orders", json={
        "items": [{"product_id": str(prod.id), "product_name": prod.name, "quantity": 1, "unit_price": float(prod.price)}],
        "shipping_address": {"fullName": "Elango Kad", "email": owner.email, "phone": "+91 9876543210", "address": "Worli", "city": "Mumbai", "state": "MH", "postalCode": "400018"},
        "payment_method": "cod",
        "delivery_method": "standard",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = order_res.json()["id"]

    rzp_res = client.post(f"/api/v1/orders/{order_id}/razorpay/create-order", headers={"Authorization": f"Bearer {cust_token}"})
    rzp_order_id = rzp_res.json()["razorpay_order_id"]
    rzp_payment_id = f"pay_test_{uuid.uuid4().hex[:12]}"
    test_sig = make_razorpay_sig(rzp_order_id, rzp_payment_id)

    client.post("/api/v1/orders/razorpay/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": test_sig,
    }, headers={"Authorization": f"Bearer {cust_token}"})

    # Admin fetches order details
    admin_res = client.get(f"/api/v1/admin/orders/{order_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_res.status_code == 200
    admin_order = admin_res.json()

    assert admin_order["payment_status"] == "Paid"
    assert admin_order["original_payment_method"] == "cod"
    assert admin_order["payment_reference"] == rzp_payment_id
    assert admin_order["razorpay_payment_id"] == rzp_payment_id
    assert admin_order["paid_at"] is not None


def test_4_failed_or_cancelled_payment_leaves_order_unpaid(client: TestClient, test_setup_data):
    """Flow 4: Failed or cancelled online payment leaves order unpaid as Pending."""
    owner = test_setup_data["owner"]
    prod = test_setup_data["product"]
    cust_token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")

    # Place COD
    order_res = client.post("/api/v1/orders", json={
        "items": [{"product_id": str(prod.id), "product_name": prod.name, "quantity": 1, "unit_price": float(prod.price)}],
        "shipping_address": {"fullName": "Elango Kad", "email": owner.email, "phone": "+91 9876543210", "address": "Worli", "city": "Mumbai", "state": "MH", "postalCode": "400018"},
        "payment_method": "cod",
        "delivery_method": "standard",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = order_res.json()["id"]

    # Customer opens Razorpay but dismisses the checkout modal
    cancel_res = client.post(
        "/api/v1/orders/razorpay/cancel",
        json={"order_id": order_id, "reason": "Modal closed by customer"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert cancel_res.status_code == 200

    # Verify order is STILL unpaid (Pending)
    fetch_res = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {cust_token}"})
    assert fetch_res.status_code == 200
    assert fetch_res.json()["payment_status"] == "Pending"


def test_5_repeated_callbacks_idempotency_prevents_duplicate_records(client: TestClient, test_setup_data):
    """Flow 5: Repeated callbacks do not cause duplicate payment records, notifications, or changes."""
    owner = test_setup_data["owner"]
    prod = test_setup_data["product"]
    cust_token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")

    order_res = client.post("/api/v1/orders", json={
        "items": [{"product_id": str(prod.id), "product_name": prod.name, "quantity": 1, "unit_price": float(prod.price)}],
        "shipping_address": {"fullName": "Elango Kad", "email": owner.email, "phone": "+91 9876543210", "address": "Worli", "city": "Mumbai", "state": "MH", "postalCode": "400018"},
        "payment_method": "cod",
        "delivery_method": "standard",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = order_res.json()["id"]

    rzp_res = client.post(f"/api/v1/orders/{order_id}/razorpay/create-order", headers={"Authorization": f"Bearer {cust_token}"})
    rzp_order_id = rzp_res.json()["razorpay_order_id"]
    rzp_payment_id = f"pay_test_{uuid.uuid4().hex[:12]}"
    sig = make_razorpay_sig(rzp_order_id, rzp_payment_id)

    verify_payload = {
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": sig,
    }

    # First verification
    v1 = client.post("/api/v1/orders/razorpay/verify", json=verify_payload, headers={"Authorization": f"Bearer {cust_token}"})
    assert v1.status_code == 200

    # Replay of exact same verification (idempotent replay)
    v2 = client.post("/api/v1/orders/razorpay/verify", json=verify_payload, headers={"Authorization": f"Bearer {cust_token}"})
    assert v2.status_code == 200
    assert v2.json()["order"]["payment_status"] == "Paid"

    # Attempt to pay with DIFFERENT payment reference on already paid order must be rejected
    v3 = client.post("/api/v1/orders/razorpay/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": f"pay_diff_{uuid.uuid4().hex[:12]}",
        "razorpay_signature": sig,
    }, headers={"Authorization": f"Bearer {cust_token}"})
    assert v3.status_code == 400


def test_6_delivered_order_exposes_correct_invoice(client: TestClient, db_session: Session, test_setup_data):
    """Flow 6: Delivered order exposes correct invoice (JSON & PDF) to its owner."""
    owner = test_setup_data["owner"]
    admin = test_setup_data["admin"]
    prod = test_setup_data["product"]
    cust_token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")
    admin_token = generate_test_token(user_id=admin.id, email=admin.email, role="admin")

    order_res = client.post("/api/v1/orders", json={
        "items": [{"product_id": str(prod.id), "product_name": prod.name, "quantity": 2, "unit_price": float(prod.price)}],
        "shipping_address": {"fullName": "Elango Kad", "email": owner.email, "phone": "+91 9876543210", "address": "Worli", "city": "Mumbai", "state": "MH", "postalCode": "400018"},
        "payment_method": "cod",
        "delivery_method": "standard",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = order_res.json()["id"]

    # Transition order to Delivered by Admin
    # Placed -> Confirmed -> Processing -> Shipped -> Delivered
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Confirmed"}, headers={"Authorization": f"Bearer {admin_token}"})
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Processing"}, headers={"Authorization": f"Bearer {admin_token}"})
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Shipped", "tracking_number": "TRK-9821"}, headers={"Authorization": f"Bearer {admin_token}"})
    del_res = client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Delivered"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert del_res.status_code == 200

    # 1. Customer fetches invoice JSON
    inv_res = client.get(f"/api/v1/orders/{order_id}/invoice", headers={"Authorization": f"Bearer {cust_token}"})
    assert inv_res.status_code == 200, inv_res.text
    inv_data = inv_res.json()
    assert "INV-" in inv_data["invoice_number"]
    assert inv_data["order_number"] == order_res.json()["order_number"]
    assert len(inv_data["items"]) == 1
    assert inv_data["items"][0]["product_name"] == prod.name
    assert inv_data["business"]["name"] == "Aurel Home Atelier"
    assert inv_data["recipient"]["full_name"] == "Elango Kad"

    # 2. Customer downloads invoice PDF
    pdf_res = client.get(f"/api/v1/orders/{order_id}/invoice/pdf", headers={"Authorization": f"Bearer {cust_token}"})
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert b"%PDF" in pdf_res.content[:10]
    assert len(pdf_res.content) > 1000


def test_7_another_customer_cannot_access_or_download_invoice(client: TestClient, test_setup_data):
    """Flow 7: Another customer cannot access or download the invoice (403 Forbidden)."""
    owner = test_setup_data["owner"]
    other_patron = test_setup_data["other_patron"]
    admin = test_setup_data["admin"]
    prod = test_setup_data["product"]
    cust_token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")
    other_token = generate_test_token(user_id=other_patron.id, email=other_patron.email, role="customer")
    admin_token = generate_test_token(user_id=admin.id, email=admin.email, role="admin")

    order_res = client.post("/api/v1/orders", json={
        "items": [{"product_id": str(prod.id), "product_name": prod.name, "quantity": 1, "unit_price": float(prod.price)}],
        "shipping_address": {"fullName": "Elango Kad", "email": owner.email, "phone": "+91 9876543210", "address": "Worli", "city": "Mumbai", "state": "MH", "postalCode": "400018"},
        "payment_method": "cod",
        "delivery_method": "standard",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = order_res.json()["id"]

    # Admin marks Delivered
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Confirmed"}, headers={"Authorization": f"Bearer {admin_token}"})
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Processing"}, headers={"Authorization": f"Bearer {admin_token}"})
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Shipped"}, headers={"Authorization": f"Bearer {admin_token}"})
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "Delivered"}, headers={"Authorization": f"Bearer {admin_token}"})

    # Unauthorized customer tries to access JSON
    unauth_json = client.get(f"/api/v1/orders/{order_id}/invoice", headers={"Authorization": f"Bearer {other_token}"})
    assert unauth_json.status_code == 403

    # Unauthorized customer tries to download PDF
    unauth_pdf = client.get(f"/api/v1/orders/{order_id}/invoice/pdf", headers={"Authorization": f"Bearer {other_token}"})
    assert unauth_pdf.status_code == 403


def test_8_non_delivered_order_does_not_expose_invoice(client: TestClient, test_setup_data):
    """Flow 8: Non-delivered order does not expose the post-delivery invoice action (400 Bad Request)."""
    owner = test_setup_data["owner"]
    prod = test_setup_data["product"]
    cust_token = generate_test_token(user_id=owner.id, email=owner.email, role="customer")

    order_res = client.post("/api/v1/orders", json={
        "items": [{"product_id": str(prod.id), "product_name": prod.name, "quantity": 1, "unit_price": float(prod.price)}],
        "shipping_address": {"fullName": "Elango Kad", "email": owner.email, "phone": "+91 9876543210", "address": "Worli", "city": "Mumbai", "state": "MH", "postalCode": "400018"},
        "payment_method": "cod",
        "delivery_method": "standard",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = order_res.json()["id"]

    # Order is currently 'Placed' (not Delivered)
    inv_res = client.get(f"/api/v1/orders/{order_id}/invoice", headers={"Authorization": f"Bearer {cust_token}"})
    assert inv_res.status_code == 400
    assert "not been marked as 'Delivered'" in inv_res.json()["detail"]

    # PDF download is also blocked with 400
    pdf_res = client.get(f"/api/v1/orders/{order_id}/invoice/pdf", headers={"Authorization": f"Bearer {cust_token}"})
    assert pdf_res.status_code == 400
    assert "not been marked as 'Delivered'" in pdf_res.json()["detail"]
