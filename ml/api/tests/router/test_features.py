import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.model_registry import Registry
from app.core.model_type import ModelType


# -----------------------------
# Fixture: registry with dummy models
# -----------------------------
@pytest.fixture
def test_registry():
    registry = Registry(None, None)
    registry.set_dummy_models()  # sets dummy models with features
    return registry


# -----------------------------
# Override global registry dependency
# -----------------------------
@pytest.fixture(autouse=True)
def override_registry_dependency(test_registry):
    from app.dependencies.dependencies import get_registry
    app.dependency_overrides[get_registry] = lambda: test_registry
    yield
    app.dependency_overrides.clear()


# -----------------------------
# Test Client
# -----------------------------
@pytest.fixture
def client():
    return TestClient(app)


# -----------------------------
# Test GET /features/score_features
# -----------------------------
def test_score_features_success(client):
    response = client.get("/features/score_features")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["features"] == ["F1", "F2", "F3"]
    assert json_data["count"] == 3


def test_score_features_model_missing(client, test_registry: Registry):
    # Remove the SCORE model to simulate KeyError
    test_registry.remove_model(ModelType.SCORE.value)
    response = client.get("/features/score_features")
    assert response.status_code == 404
    assert "Model not found" in response.json()["detail"]


# -----------------------------
# Test GET /features/weakest_link
# -----------------------------
def test_weakest_link_features_success(client):
    response = client.get("/features/weakest_link")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["features"] == ["F4", "F5", "F6"]
    assert json_data["count"] == 3


def test_weakest_link_features_model_missing(client, test_registry):
    # Remove the WEAKEST_LINK model to simulate KeyError
    test_registry.remove_model(ModelType.WEAKEST_LINK.value)
    response = client.get("/features/weakest_link")
    assert response.status_code == 404
    assert "Model not found" in response.json()["detail"]


def test_weakest_link_features_no_features(client, test_registry):
    # Set features to None to simulate missing features
    model = test_registry.get_model(ModelType.WEAKEST_LINK.value)
    model._features = None
    response = client.get("/features/weakest_link")
    assert response.status_code == 404
    assert response.json()["detail"] == "Model features non-existent"
