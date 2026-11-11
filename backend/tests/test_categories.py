import uuid
from fastapi.testclient import TestClient


def test_list_categories_empty(client: TestClient):
    response = client.get("/api/v1/categories")
    assert response.status_code == 200
    assert response.json() == []


def test_create_category_unauthorized(client: TestClient):
    # Write endpoint must be protected from untrusted clients
    payload = {
        "name": "Living & Furniture",
        "slug": "living",
        "realm_number": "Realm 01",
        "description": "Architectural forms for domestic rituals.",
        "active": True,
    }
    response = client.post("/api/v1/categories", json=payload)
    assert response.status_code == 401
    assert "credentials were not provided" in response.json()["detail"].lower()


def test_create_category_authorized(client: TestClient, admin_headers: dict):
    payload = {
        "name": "Living & Furniture",
        "slug": "living",
        "realm_number": "Realm 01",
        "description": "Architectural forms for domestic rituals.",
        "active": True,
    }
    response = client.post("/api/v1/categories", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Living & Furniture"
    assert data["slug"] == "living"
    assert "id" in data


def test_create_duplicate_category_slug(client: TestClient, admin_headers: dict):
    payload = {
        "name": "Bedroom & Sleep",
        "slug": "bedroom",
    }
    # Create first
    res1 = client.post("/api/v1/categories", json=payload, headers=admin_headers)
    assert res1.status_code == 201

    # Attempt duplicate
    res2 = client.post("/api/v1/categories", json=payload, headers=admin_headers)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_get_category_by_id(client: TestClient, admin_headers: dict):
    payload = {
        "name": "Curtains & Textiles",
        "slug": "textiles",
        "realm_number": "Realm 03",
    }
    create_res = client.post("/api/v1/categories", json=payload, headers=admin_headers)
    cat_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/categories/{cat_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Curtains & Textiles"


def test_get_nonexistent_category(client: TestClient):
    fake_id = str(uuid.uuid4())
    response = client.get(f"/api/v1/categories/{fake_id}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_get_category_by_slug(client: TestClient, admin_headers: dict):
    slug = f"ceramics-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/categories",
        json={"name": "Ceramics", "slug": slug, "realm_number": "Realm 08"},
        headers=admin_headers,
    )

    res = client.get(f"/api/v1/categories/slug/{slug}")
    assert res.status_code == 200
    assert res.json()["name"] == "Ceramics"
    assert res.json()["slug"] == slug

    missing_res = client.get("/api/v1/categories/slug/missing-realm-xyz")
    assert missing_res.status_code == 404


def test_update_category_authorized(client: TestClient, admin_headers: dict):
    slug = f"edit-{uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/api/v1/categories",
        json={"name": "Before Edit", "slug": slug},
        headers=admin_headers,
    )
    cat_id = create_res.json()["id"]

    patch_res = client.patch(
        f"/api/v1/categories/{cat_id}",
        json={"name": "After Edit", "realm_number": "Realm 99"},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "After Edit"
    assert patch_res.json()["realm_number"] == "Realm 99"


def test_delete_category_safe_and_cascade_prevention(client: TestClient, admin_headers: dict):
    slug = f"del-{uuid.uuid4().hex[:6]}"
    cat_res = client.post(
        "/api/v1/categories",
        json={"name": "To Delete", "slug": slug},
        headers=admin_headers,
    )
    cat_id = cat_res.json()["id"]

    # Assign a product to this category
    client.post(
        "/api/v1/products",
        json={"name": "Assigned Product", "slug": f"p-{uuid.uuid4().hex[:6]}", "price": 100, "category_id": cat_id},
        headers=admin_headers,
    )

    # Hard delete attempt must return 409 Conflict to protect products
    conflict_res = client.delete(
        f"/api/v1/categories/{cat_id}?soft=false",
        headers=admin_headers,
    )
    assert conflict_res.status_code == 409
    assert "Cannot delete realm" in conflict_res.json()["detail"]

    # Soft delete succeeds
    soft_res = client.delete(
        f"/api/v1/categories/{cat_id}?soft=true",
        headers=admin_headers,
    )
    assert soft_res.status_code == 200
    assert soft_res.json()["active"] is False


