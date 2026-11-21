import app.core.dummy_models as dm
from pandas import DataFrame


def test_score_dummy_model():
    model = dm.DummyScoreModel()

    feature_values = DataFrame({
        "f1": [3.0],
        "f2": [3.0],
        "f3": [3.0],
    })

    assert 4.5 == model.predict(feature_values)[0]


def test_weakest_link_dummy_model():
    model = dm.DummyWeakestLinkModel()

    feature_values = DataFrame({
        "f1": [3.0],
        "f2": [3.0],
        "f3": [3.0],
    })

    prediction = model.predict(feature_values)[0]

    assert prediction in [
        "head", "shoulder", "back",
        "waist", "hip", "knee", "ankle"
    ]
