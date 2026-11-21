import pytest
from fastapi.testclient import TestClient
from main import app


# -----------------------------
# Test Client fixture
# -----------------------------
@pytest.fixture
def client():
    return TestClient(app)


# -----------------------------
# Test GET /health/
# -----------------------------
def test_health_check(client):
    response = client.get("/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
