import uuid
from decimal import Decimal
from fastapi.testclient import TestClient


def create_sample_category(client: TestClient, admin_headers: dict) -> str:
    res = client.post(
        "/api/v1/categories",
        json={
            "name": "Living & Seating",
            "slug": f"living-{uuid.uuid4().hex[:6]}",
            "realm_number": "Realm 01",
        },
        headers=admin_headers,
    )
    return res.json()["id"]


def test_list_products_empty(client: TestClient):
    response = client.get("/api/v1/products")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1


def test_create_product_unauthorized(client: TestClient):
    payload = {
        "name": "Soren Lounge Chair",
        "slug": "soren-lounge-chair",
        "price": 48900.00,
        "stock": 5,
    }
    response = client.post("/api/v1/products", json=payload)
    assert response.status_code == 401
    assert "credentials were not provided" in response.json()["detail"].lower()


def test_create_product_validation_negative_price(client: TestClient, admin_headers: dict):
    payload = {
        "name": "Invalid Price Chair",
        "slug": "invalid-price-chair",
        "price": -100.00,
        "stock": 5,
    }
    response = client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert response.status_code == 422  # Pydantic validation error


def test_create_product_validation_negative_stock(client: TestClient, admin_headers: dict):
    payload = {
        "name": "Invalid Stock Lamp",
        "slug": "invalid-stock-lamp",
        "price": 12000.00,
        "stock": -1,
    }
    response = client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert response.status_code == 422  # Pydantic validation error


def test_create_product_with_category(client: TestClient, admin_headers: dict):
    cat_id = create_sample_category(client, admin_headers)

    payload = {
        "name": "Soren Lounge Chair",
        "slug": "soren-lounge-chair",
        "subtitle": "Charred Japanese Ash & Woven Flax",
        "description": "Architectural repose and craftsmanship.",
        "price": 48900.00,
        "compare_at_price": 56000.00,
        "stock": 7,
        "category_id": cat_id,
        "images": ["https://example.com/soren-1.jpg"],
        "details": ["PEFC certified Japanese ash", "Mortise-and-tenon joinery"],
        "materials": "Charred Ash, Belgian Linen",
        "dimensions": "84 x 92 x 76 cm",
        "active": True,
    }
    response = client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Soren Lounge Chair"
    assert data["slug"] == "soren-lounge-chair"
    assert Decimal(str(data["price"])) == Decimal("48900.00")
    assert data["stock"] == 7
    assert data["category"]["id"] == cat_id


def test_create_product_duplicate_slug(client: TestClient, admin_headers: dict):
    payload = {
        "name": "Komorebi Ceramic Lamp",
        "slug": "komorebi-ceramic-lamp",
        "price": 18500.00,
        "stock": 10,
    }
    res1 = client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_get_product_by_id(client: TestClient, admin_headers: dict):
    create_res = client.post(
        "/api/v1/products",
        json={
            "name": "Wabi Sabi Ceramic Vase",
            "slug": f"vase-{uuid.uuid4().hex[:6]}",
            "price": 7500.00,
            "stock": 3,
        },
        headers=admin_headers,
    )
    product_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/products/{product_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Wabi Sabi Ceramic Vase"


def test_update_product_partial(client: TestClient, admin_headers: dict):
    create_res = client.post(
        "/api/v1/products",
        json={
            "name": "Original Name",
            "slug": f"item-{uuid.uuid4().hex[:6]}",
            "price": 1000.00,
            "stock": 2,
        },
        headers=admin_headers,
    )
    product_id = create_res.json()["id"]

    # Partial update price & stock
    update_res = client.patch(
        f"/api/v1/products/{product_id}",
        json={"price": 1250.00, "stock": 10},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert Decimal(str(update_res.json()["price"])) == Decimal("1250.00")
    assert update_res.json()["stock"] == 10
    assert update_res.json()["name"] == "Original Name"


def test_delete_product_safely(client: TestClient, admin_headers: dict):
    create_res = client.post(
        "/api/v1/products",
        json={
            "name": "Temporary Object",
            "slug": f"temp-{uuid.uuid4().hex[:6]}",
            "price": 2000.00,
            "stock": 1,
            "active": True,
        },
        headers=admin_headers,
    )
    product_id = create_res.json()["id"]

    # Soft delete
    del_res = client.delete(f"/api/v1/products/{product_id}?soft=true", headers=admin_headers)
    assert del_res.status_code == 200
    assert del_res.json()["active"] is False

    # Should not appear in active product listings
    list_res = client.get("/api/v1/products?only_active=true")
    product_ids = [p["id"] for p in list_res.json()["items"]]
    assert product_id not in product_ids


def test_get_product_by_slug(client: TestClient, admin_headers: dict):
    slug = f"unique-item-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/products",
        json={
            "name": "Slug Lookup Item",
            "slug": slug,
            "price": 3500.00,
            "stock": 4,
        },
        headers=admin_headers,
    )

    res = client.get(f"/api/v1/products/slug/{slug}")
    assert res.status_code == 200
    assert res.json()["name"] == "Slug Lookup Item"
    assert res.json()["slug"] == slug

    # Non-existent slug returns 404
    missing_res = client.get("/api/v1/products/slug/non-existent-slug-xyz")
    assert missing_res.status_code == 404


def test_filter_products_by_category_slug(client: TestClient, admin_headers: dict):
    cat_slug = f"custom-realm-{uuid.uuid4().hex[:6]}"
    cat_res = client.post(
        "/api/v1/categories",
        json={"name": "Custom Realm", "slug": cat_slug},
        headers=admin_headers,
    )
    cat_id = cat_res.json()["id"]

    client.post(
        "/api/v1/products",
        json={"name": "Realm Item 1", "slug": f"r1-{uuid.uuid4().hex[:6]}", "price": 1000, "category_id": cat_id},
        headers=admin_headers,
    )
    client.post(
        "/api/v1/products",
        json={"name": "Realm Item 2", "slug": f"r2-{uuid.uuid4().hex[:6]}", "price": 2000, "category_id": cat_id},
        headers=admin_headers,
    )

    res = client.get(f"/api/v1/products?category_slug={cat_slug}")
    assert res.status_code == 200
    assert res.json()["total"] == 2
    for item in res.json()["items"]:
        assert item["category"]["slug"] == cat_slug


def test_adjust_product_stock_authorized(client: TestClient, admin_headers: dict):
    create_res = client.post(
        "/api/v1/products",
        json={"name": "Stock Test Chair", "slug": f"stock-test-{uuid.uuid4().hex[:6]}", "price": 4500, "stock": 5},
        headers=admin_headers,
    )
    product_id = create_res.json()["id"]

    # Adjust stock to 25
    adj_res = client.patch(
        f"/api/v1/products/{product_id}/stock",
        json={"stock": 25, "reason": "Restock from artisan workshop"},
        headers=admin_headers,
    )
    assert adj_res.status_code == 200
    assert adj_res.json()["stock"] == 25

    # Negative stock validation rejected
    neg_res = client.patch(
        f"/api/v1/products/{product_id}/stock",
        json={"stock": -5},
        headers=admin_headers,
    )
    assert neg_res.status_code == 422


def test_adjust_product_stock_unauthorized(client: TestClient):
    res = client.patch(
        f"/api/v1/products/{uuid.uuid4()}/stock",
        json={"stock": 10},
    )
    assert res.status_code == 401


def test_filter_products_by_stock_status(client: TestClient, admin_headers: dict):
    # Create one out-of-stock, one low-stock, one high-stock
    client.post(
        "/api/v1/products",
        json={"name": "Zero Stock", "slug": f"zero-{uuid.uuid4().hex[:6]}", "price": 1000, "stock": 0},
        headers=admin_headers,
    )
    client.post(
        "/api/v1/products",
        json={"name": "Low Stock", "slug": f"low-{uuid.uuid4().hex[:6]}", "price": 1000, "stock": 3},
        headers=admin_headers,
    )
    client.post(
        "/api/v1/products",
        json={"name": "High Stock", "slug": f"high-{uuid.uuid4().hex[:6]}", "price": 1000, "stock": 20},
        headers=admin_headers,
    )

    out_res = client.get("/api/v1/products?stock_status=out_of_stock")
    assert out_res.status_code == 200
    for p in out_res.json()["items"]:
        assert p["stock"] == 0

    low_res = client.get("/api/v1/products?stock_status=low_stock")
    assert low_res.status_code == 200
    for p in low_res.json()["items"]:
        assert 1 <= p["stock"] <= 5


def test_product_image_persistence_and_serialization(client: TestClient, admin_headers: dict):
    """Regression test ensuring static uploaded image paths persist and serialize correctly."""
    slug = f"artisan-shelf-{uuid.uuid4().hex[:6]}"
    image_path = "/static/uploads/test_cbb287ecd3e64358af476ba12e6e12fd.png"

    # Create product with uploaded image
    create_res = client.post(
        "/api/v1/products",
        json={
            "name": "Artisan Oak Shelf",
            "slug": slug,
            "price": 18500.00,
            "stock": 12,
            "images": [image_path],
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    created_product = create_res.json()
    product_id = created_product["id"]
    assert created_product["images"] == [image_path]

    # Verify retrieval by slug
    get_res = client.get(f"/api/v1/products/slug/{slug}")
    assert get_res.status_code == 200
    assert get_res.json()["images"] == [image_path]

    # Update product and ensure images persist
    new_image_path = "/static/uploads/replacement_4421a9b6a1e74a3cbdd738e8c6e4f019.png"
    update_res = client.put(
        f"/api/v1/products/{product_id}",
        json={
            "images": [new_image_path],
        },
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["images"] == [new_image_path]

    # Verify retrieval reflects new canonical image
    refreshed_res = client.get(f"/api/v1/products/slug/{slug}")
    assert refreshed_res.status_code == 200
    assert refreshed_res.json()["images"] == [new_image_path]



