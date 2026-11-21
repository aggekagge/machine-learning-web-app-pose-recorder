import pytest
from app.core.model import Model
from app.core.dummy_models import DummyScoreModel


@pytest.fixture
def model():
    return Model(
        model=DummyScoreModel(),
        features=["F1", "F2", "F3"]
    )


def test_get_model(model: Model):
    model_instance: DummyScoreModel = model.get_model()
    assert model_instance is not None
    assert model_instance.__class__.__name__ == "DummyScoreModel"


def test_get_features(model: Model):
    features = model.get_features()
    assert features is not None
    assert features == ["F1", "F2", "F3"]
