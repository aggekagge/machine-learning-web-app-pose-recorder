import pytest
from unittest.mock import MagicMock

from app.core.model_registry import Registry
from app.core.model import Model
from app.core.model_type import ModelType
import app.core.dummy_models as dm


# ----------------------------
# Fixtures
# ----------------------------
@pytest.fixture
def mock_model_loader():
    loader = MagicMock()
    loader.side_effect = lambda name: f"loaded_model_from_{name}"
    return loader


@pytest.fixture
def mock_feature_loader():
    loader = MagicMock()
    loader.side_effect = lambda name: [f"features_from_{name}"]
    return loader


@pytest.fixture
def registry(mock_model_loader, mock_feature_loader):
    return Registry(
        model_loader=mock_model_loader, feature_loader=mock_feature_loader
        )


# ----------------------------
# Initialization Tests
# ----------------------------
def test_registry_initialization(registry):
    assert registry._models == {}


# ----------------------------
# register_model Tests
# ----------------------------
def test_register_model_stores_model(registry):
    registry.register_model("test_model")
    model: Model = registry.get_model("test_model")

    assert isinstance(model, Model)
    assert model.get_model() == "loaded_model_from_test_model"
    assert model.get_features() == ["features_from_test_model"]


def test_register_model_calls_loaders(
        registry, mock_model_loader, mock_feature_loader
        ):
    registry.register_model("test_model")

    mock_model_loader.assert_called_once_with("test_model")
    mock_feature_loader.assert_called_once_with("test_model")


def test_register_model_overwrites_existing(registry):
    registry.register_model("test_model")
    registry.register_model("test_model")

    model: Model = registry.get_model("test_model")
    assert model.get_model() == "loaded_model_from_test_model"
    assert model.get_features() == ["features_from_test_model"]


# ----------------------------
# get_model Tests
# ----------------------------
def test_get_model_returns_correct_model(registry):
    registry.register_model("test_model")
    model: Model = registry.get_model("test_model")

    assert model.get_model() == "loaded_model_from_test_model"
    assert model.get_features() == ["features_from_test_model"]


def test_get_model_raises_key_error_if_missing(registry):
    with pytest.raises(KeyError) as exc_info:
        registry.get_model("nonexistent_model")
    assert "not registered" in str(exc_info.value)


# ----------------------------
# set_dummy_models Tests
# ----------------------------
def test_set_dummy_models_registers_models(registry):
    registry.set_dummy_models()

    score_model: Model = registry.get_model(ModelType.SCORE.value)
    weakest_link_model: Model = registry.get_model(
        ModelType.WEAKEST_LINK.value
        )

    assert isinstance(score_model.get_model(), dm.DummyScoreModel)
    assert score_model.get_features() == ["F1", "F2", "F3"]

    assert isinstance(weakest_link_model.get_model(), dm.DummyWeakestLinkModel)
    assert weakest_link_model.get_features() == ["F4", "F5", "F6"]


def test_set_dummy_models_clears_existing_models(registry):
    registry.register_model("test_model")
    registry.set_dummy_models()

    with pytest.raises(KeyError):
        registry.get_model("test_model")


# ----------------------------
# remove_model Tests
# ----------------------------
def test_remove_model_deletes_model(registry):
    registry.register_model("test_model")
    registry.remove_model("test_model")

    with pytest.raises(KeyError):
        registry.get_model("test_model")


def test_remove_model_nonexistent_does_not_error(registry):
    registry.remove_model("nonexistent_model")  # should silently do nothing


# ----------------------------
# Multiple model registration test
# ----------------------------
def test_multiple_models_can_be_registered(registry):
    registry.register_model("model1")
    registry.register_model("model2")

    model1: Model = registry.get_model("model1")
    model2: Model = registry.get_model("model2")

    assert model1.get_model() == "loaded_model_from_model1"
    assert model2.get_model() == "loaded_model_from_model2"
