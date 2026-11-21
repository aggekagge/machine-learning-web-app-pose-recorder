import pytest
import pandas as pd
from pandas import DataFrame
from app.utils.utils import generate_model_input


def test_generate_model_input_valid():
    features = ["age", "height", "weight"]
    values = [25.0, 180.0, 75.0]

    df = generate_model_input(features, values)

    expected = pd.DataFrame({
        "age": [25.0],
        "height": [180.0],
        "weight": [75.0]
    })

    pd.testing.assert_frame_equal(df, expected)


def test_generate_model_input_column_names():
    features = ["f1", "f2"]
    values = [1.0, 2.0]

    df = generate_model_input(features, values)

    assert list(df.columns) == features


def test_generate_model_input_values():
    features = ["temperature"]
    values = [36.6]

    df = generate_model_input(features, values)

    assert df.iloc[0]["temperature"] == 36.6


def test_generate_model_input_length_mismatch():
    features = ["age", "height"]
    values = [25.0]

    with pytest.raises(ValueError, match="Number of features must equal"):
        generate_model_input(features, values)


def test_generate_model_input_empty():
    features = []
    values = []

    df = generate_model_input(features, values)

    assert isinstance(df, DataFrame)
    assert df.empty
