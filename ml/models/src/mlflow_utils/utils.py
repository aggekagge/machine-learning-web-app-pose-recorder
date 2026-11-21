from __future__ import annotations

from typing import Any, Callable, Dict, Optional
import mlflow as mlf
from pathlib import Path
from dotenv import load_dotenv
from os import environ
import warnings
warnings.filterwarnings(
    "ignore",
    message="Unverified HTTPS request"
)


def credentials_exists() -> bool:
    """
    Check if the required MLflow environment variables exist.
    """
    required_vars = [
        "MLFLOW_TRACKING_USERNAME",
        "MLFLOW_TRACKING_PASSWORD",
        "MLFLOW_TRACKING_URI",
    ]

    return all(var in environ for var in required_vars)


def load_credentials(path: Path) -> None:
    """
    Load environment variables from a .env file into os.environ.

    Parameters:
        path (Path): Path to the .env file

    Raises:
        FileNotFoundError: If the file does not exist
        ValueError: If a line is not in KEY=VALUE format
    """

    if not path.exists():
        raise FileNotFoundError(f".env file not found: {path}")

    if not path.is_file():
        raise ValueError(f"Path is not a file: {path}")

    load_dotenv(path)


def run_and_register_mlflow(
    *,
    run_name: str,
    experiment_name: Optional[str] = None,

    params: Optional[Dict[str, Any]] = None,
    metrics: Optional[Dict[str, float]] = None,
    tags: Optional[Dict[str, Any]] = None,

    model: Optional[Any] = None,
    flavor: Optional[Callable[..., Any]] = None,
    flavor_kwargs: Optional[Dict[str, Any]] = None,

    name: str = "model",
    tracking_uri: Optional[str] = None,

    nested: bool = False,
) -> Dict[str, Any]:
    """
    Start an MLflow run, log params/metrics/tags, and optionally
    log/register a model.

    Notes
    -----
    If `model` is provided, `flavor` must also be provided.

    `flavor_kwargs` is forwarded to the MLflow flavor callable
     and should contain any flavor-specific arguments such as:
    - input_example
    - signature
    - registered_model_name
    - custom flavor options
    """

    if tracking_uri:
        mlf.set_tracking_uri(tracking_uri)

    if experiment_name is not None:
        mlf.set_experiment(experiment_name)

    params = params or {}
    metrics = metrics or {}
    tags = tags or {}
    flavor_kwargs = flavor_kwargs or {}

    if (model is None) != (flavor is None):
        raise ValueError(
            "`model` and `flavor` must be provided together."
        )

    result: Dict[str, Any] = {
        "run_id": None,
        "model_uri": None,
        "registered_model_version": None,
    }

    with mlf.start_run(run_name=run_name, nested=nested) as run:
        result["run_id"] = run.info.run_id

        if params:
            mlf.log_params(params)

        if metrics:
            for key, value in metrics.items():
                mlf.log_metric(key, float(value))

        if tags:
            mlf.set_tags(
                {key: str(value) for key, value in tags.items()}
            )

        if model is not None:
            model_info = flavor(
                model,
                name=name,
                **flavor_kwargs,
            )

            result["model_uri"] = getattr(model_info, "model_uri", None)
            result["registered_model_version"] = getattr(
                model_info,
                "registered_model_version",
                None,
            )

    return result
