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
    registry.set_dummy_models()
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
# Test helpers
# -----------------------------
def get_valid_request():
    # Adjust length to match dummy model features
    return {"features": [1, 2, 3]}


def get_invalid_request():
    # Length mismatch with dummy model features
    return {"features": [1, 2]}


# -----------------------------
# Tests for /predict/ (Score model)
# -----------------------------
def test_predict_score_success(client):
    response = client.post("/predict/", json=get_valid_request())
    assert response.status_code == 200
    json_data = response.json()
    assert "prediction" in json_data


def test_predict_score_feature_length_mismatch(client):
    response = client.post("/predict/", json=get_invalid_request())
    assert response.status_code == 400
    assert "Number of features" in response.json()["detail"]


def test_predict_score_model_not_found(client, test_registry):
    # Remove the Score model to simulate missing model
    test_registry.remove_model(ModelType.SCORE.value)
    response = client.post("/predict/", json=get_valid_request())
    assert response.status_code == 404
    assert "Model not found" in response.json()["detail"]


# -----------------------------
# Tests for /predict/weakest_link
# -----------------------------
def test_predict_weakest_link_success(client):
    response = client.post("/predict/weakest_link", json=get_valid_request())
    assert response.status_code == 200
    json_data = response.json()
    assert "prediction" in json_data


def test_predict_weakest_link_feature_length_mismatch(client):
    response = client.post("/predict/weakest_link", json=get_invalid_request())
    assert response.status_code == 400
    assert "Number of features" in response.json()["detail"]


def test_predict_weakest_link_model_not_found(client, test_registry):
    # Remove the Weakest Link model to simulate missing model
    test_registry.remove_model(ModelType.WEAKEST_LINK.value)
    response = client.post("/predict/weakest_link", json=get_valid_request())
    assert response.status_code == 404
    assert "Model not found" in response.json()["detail"]
