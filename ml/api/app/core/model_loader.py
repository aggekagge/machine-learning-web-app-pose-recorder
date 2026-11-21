from typing import List, Any
from os import getenv
import mlflow

"""
Utility functions for loading a production ("champion") model and its input
feature metadata from an MLflow Model Registry.

- load_model(model_type):
    Validates the provided model_type, reads the MLflow tracking URI from the
    MLFLOW_TRACKING_URI environment variable, and loads the model registered
    as `models:/<model_type>@champion` using mlflow.pyfunc. Raises clear
    exceptions if configuration is missing or loading fails.

- load_model_features(model_type):
    Validates the provided model_type, connects to the MLflow tracking server,
    retrieves model metadata for `models:/<model_type>@champion`, and extracts
    the input feature names from the model's signature. Raises errors if the
    environment is misconfigured, the model cannot be found, or no valid input
    signature is defined.

Together, these functions provide a safe and consistent way to fetch both a
deployed MLflow model and the feature schema it expects.
"""


def load_model(model_type: str) -> Any:
    if not model_type or not model_type.strip():
        raise ValueError("model_type must be a non-empty string.")

    mlflow_uri = getenv("MLFLOW_TRACKING_URI")
    if not mlflow_uri:
        raise EnvironmentError(
            "Environment variable 'MLFLOW_TRACKING_URI' is not set."
            )

    mlflow.set_tracking_uri(mlflow_uri)
    model_uri = f"models:/{model_type}@champion"

    try:
        model = mlflow.pyfunc.load_model(model_uri)
    except Exception as e:
        raise RuntimeError(f"Failed to load model '{model_type}': {e}")

    return model


def load_model_features(model_type: str) -> List[str]:

    if not model_type or not model_type.strip():
        raise ValueError("model_type must be a non-empty string.")

    mlflow_uri = getenv("MLFLOW_TRACKING_URI")
    if not mlflow_uri:
        raise EnvironmentError(
            "Environment variable 'MLFLOW_TRACKING_URI' is not set."
        )

    mlflow.set_tracking_uri(mlflow_uri)
    model_uri = f"models:/{model_type}@champion"

    try:
        model_info = mlflow.models.get_model_info(model_uri)
    except Exception as e:
        raise RuntimeError(f"Failed to get model info for '{model_type}': {e}")

    if not model_info.signature or not model_info.signature.inputs:
        raise RuntimeError(
            f"Model '{model_type}' does not have a valid input signature."
        )

    feature_names = [col.name for col in model_info.signature.inputs]
    return feature_names
