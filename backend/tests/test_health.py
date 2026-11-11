from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Aurel Home API" in data["message"]
    assert data["docs"] == "/docs"
    assert data["health"] == "/health"
    assert data["api_v1"] == "/api/v1"


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "app_name" in data
    assert "database" in data
    # Health endpoint safely reports database status without failing when unconfigured
    assert "status" in data["database"]
    assert "connected" in data["database"]
