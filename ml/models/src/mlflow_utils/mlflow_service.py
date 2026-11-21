import mlflow as mlf
from mlflow.entities import Run
from mlflow.exceptions import MlflowException, RestException
from mlflow.entities.model_registry import ModelVersion
import warnings
from typing import Tuple, Any

warnings.filterwarnings(
    "ignore",
    message="Unverified HTTPS request"
)


class MlFlowService:
    """
    Service class for interacting with an MLflow tracking server and model
    registry.

    Args:
        tracking_uri: Name of the environment variable containing the MLflow
            tracking URI.
    """

    def __init__(self, tracking_uri: str):
        self.client: mlf.MlflowClient = mlf.MlflowClient(
            tracking_uri=tracking_uri
        )

    def test_mlflow_connection(self) -> Tuple[bool, str]:
        """
        Test whether the MLflow tracking server is reachable.

        Returns:
            A tuple where:
            - the first value indicates whether the connection was successful
            - the second value contains a descriptive status message
        """
        try:
            self.client.search_experiments(max_results=1)
            return True, "Connection to MLflow successful"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"

    def set_model_alias(
            self, model_name: str, alias: str, version: str
    ) -> bool:
        """
        Assign an alias to a specific registered model version.

        Args:
            model_name: Name of the registered model.
            alias: Alias to assign, for example "champion" or "challenger".
            version: Model version to which the alias should point.

        Returns:
            True if the alias was set successfully, otherwise False.
        """
        try:
            self.client.set_registered_model_alias(
                name=model_name,
                alias=alias,
                version=version
            )
            return True
        except Exception as e:
            print(f"Failed to set alias: {e}")
            return False

    def get_latest_version(self, model_name: str) -> str | None:
        """
        Retrieve the latest version number for a registered model.

        The latest version is determined by comparing the numeric model version
        values returned by MLflow.

        Args:
            model_name: Name of the registered model.

        Returns:
            The latest model version as a string, or None if no versions exist
            or if the lookup fails.
        """
        try:
            versions = self.client.search_model_versions(
                f"name='{model_name}'"
            )

            if not versions:
                return None

            # Versions are strings. convert to int for comparison
            latest = max(versions, key=lambda v: int(v.version))
            return latest.version

        except Exception as e:
            print(f"Failed to get latest version: {e}")
            return None

    def load_model(self, model_uri: str) -> Any | None:
        """
        Load an MLflow model from a model URI.

        Args:
            model_uri: MLflow model URI.
                Examples:
                    "runs:/<run_id>/model"
                    "models:/ModelName/1"
                    "models:/ModelName/Production"
                    "./mlruns/0/<run_id>/artifacts/model"

        Returns:
            The loaded MLflow pyfunc model or none.
        """
        try:
            model = mlf.pyfunc.load_model(model_uri)
            print(f"Model loaded from: {model_uri}")
            return model

        except Exception as e:
            print(f"Failed to load model from {model_uri}: {e}")
            return None

    def get_metric_value(self, run: Run, metric_name: str) -> float:
        """
        Retrieve a metric value from an MLflow run.

        Args:
            run: MLflow run object containing logged metrics.
            metric_name: Name of the metric to retrieve.

        Returns:
            The metric value as a float.

        Raises:
            ValueError: If the requested metric is not present in the run.
        """
        value = run.data.metrics.get(metric_name)
        if value is None:
            raise ValueError(
                f"Run {run.info.run_id} is missing "
                f"required metric '{metric_name}'."
            )
        return value

    def get_run(self, run_id: str) -> Run | None:
        """
        Safely retrieve an MLflow run by ID.

        Args:
            run_id: MLflow run ID

        Returns:
            Run object if found, otherwise None

        Raises:
            MlflowException: For unexpected MLflow errors
        """
        try:
            return self.client.get_run(run_id)
        except RestException as e:
            if e.error_code in {"RESOURCE_DOES_NOT_EXIST", "NOT_FOUND"}:
                return None
            raise
        except MlflowException:
            # Let unexpected MLflow errors propagate
            raise

    def deploy_model_from_model_id(
        self,
        model_id: str,
        model_registry_name: str,
        run_id: str | None = None,
    ) -> ModelVersion:
        """
        Register a logged MLflow model, identified by its model ID,
        into the model registry.

        This is intended for MLflow logged models whose URI looks like:

            models:/m-3728927031ce43878544f8f5f198b0e4

        rather than old-style run artifact models like:

            runs:/<run_id>/model

        Args:
            model_id: MLflow logged model ID, for example
                "m-3728927031ce43878544f8f5f198b0e4".
                You may also pass the full URI
                "models:/m-3728927031ce43878544f8f5f198b0e4".
            model_registry_name: Name of the registered model.
            run_id: Optional MLflow run ID associated with the logged model.
                If provided, the method validates that the run exists and links
                the created model version to the run.

        Returns:
            The created MLflow ModelVersion object.

        Raises:
            ValueError: If the run or registered model does not exist.
            MlflowException: If model registration fails.
        """

        # Optional run validation
        if run_id is not None:
            try:
                self.client.get_run(run_id)
            except RestException as e:
                if e.error_code in {"RESOURCE_DOES_NOT_EXIST", "NOT_FOUND"}:
                    raise ValueError(f"Run '{run_id}' does not exist.") from e
                raise

        # Ensure the registered model exists
        try:
            self.client.get_registered_model(model_registry_name)
        except RestException as e:
            if e.error_code in {"RESOURCE_DOES_NOT_EXIST", "NOT_FOUND"}:
                raise ValueError(
                    f"Registered model '{model_registry_name}' does not exist."
                ) from e
            raise

        # Accept either raw model ID or full models:/ URI
        if model_id.startswith("models:/"):
            model_source = model_id
        else:
            model_source = f"models:/{model_id}"

        model_version = self.client.create_model_version(
            name=model_registry_name,
            source=model_source,
            run_id=run_id,
        )

        print(
            f"Registered logged model '{model_source}' "
            f"as model '{model_registry_name}' "
            f"version '{model_version.version}'."
        )

        return model_version

    def compare_and_promote(
        self,
        model_registry_name: str,
        primary_metric: str,
        higher_is_better: bool = True,
    ) -> bool:
        """
        Compare challenger vs champion using a user-defined metric.

        Args:
            model_registry_name: Name of registered model
            primary_metric: Metric to compare
                (e.g. "test_r2", "test_f1_weighted")
            higher_is_better: Direction of optimization

        Returns:
            True if challenger was promoted, False otherwise
        """
        print("Comparing and possibly promoting challenger model...")

        def get_version_by_alias(alias: str):
            try:
                return self.client.get_model_version_by_alias(
                    name=model_registry_name,
                    alias=alias,
                )
            except Exception:
                return None

        challenger = get_version_by_alias("challenger")
        if challenger is None:
            raise ValueError(
                f"No challenger alias found for model '{model_registry_name}'."
            )

        champion = get_version_by_alias("champion")

        challenger_run = self.client.get_run(challenger.run_id)
        challenger_metric = self.get_metric_value(
            challenger_run, primary_metric
        )

        # No champion exists, so promote challenger directly
        if champion is None:
            promoted = self.set_model_alias(
                model_name=model_registry_name,
                alias="champion",
                version=challenger.version,
            )
            if not promoted:
                raise RuntimeError(
                    f"Failed to promote challenger v{challenger.version} "
                    f"to champion for model '{model_registry_name}'."
                )

            print(
                f"No champion exists."
                f"Promoted challenger v{challenger.version} "
                f"with {primary_metric}={challenger_metric:.6f}"
            )
            return True

        champion_run = self.client.get_run(champion.run_id)
        champion_metric = self.get_metric_value(
            champion_run, primary_metric
        )

        is_better = (
            challenger_metric > champion_metric
            if higher_is_better
            else challenger_metric < champion_metric
        )

        if not is_better:
            print(
                f"Kept champion v{champion.version}. "
                f"{primary_metric}: challenger={challenger_metric:.6f}, "
                f"champion={champion_metric:.6f}"
            )
            return False

        promoted = self.set_model_alias(
            model_name=model_registry_name,
            alias="champion",
            version=challenger.version,
        )
        if not promoted:
            raise RuntimeError(
                f"Failed to promote challenger v{challenger.version} "
                f"to champion for model '{model_registry_name}'."
            )

        print(
            f"Promoted challenger v{challenger.version} → champion. "
            f"{primary_metric}: challenger={challenger_metric:.6f}, "
            f"champion={champion_metric:.6f}"
        )
        return True
