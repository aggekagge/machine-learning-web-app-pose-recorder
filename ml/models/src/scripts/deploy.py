from argparse import Namespace
from os import getenv
from sys import exit

from src.mlflow_utils import (
    credentials_exists,
    MlFlowService
)
from src.loaders import (
    load_yaml_file
)
from src.configs import (
    PipelineConfig
)


def run_deploy_script(args: Namespace):

    if not credentials_exists():
        raise RuntimeError(
            "mlflow credentials have not been injected to the env variables"
        )

    try:
        jobs = load_yaml_file(args.config_file)
    except ValueError as e:
        if "empty" in str(e):
            print("No jobs specified. Exiting program...")
            exit(0)

    jobs = PipelineConfig.model_validate(jobs)

    service = MlFlowService(getenv("MLFLOW_TRACKING_URI"))
    conn, mess = service.test_mlflow_connection()
    print(mess)
    if not conn:
        print("Exiting program...")
        exit(1)

    for job in jobs.jobs:
        service.deploy_model_from_model_id(
            model_id=job.model_id,
            model_registry_name=job.model_registry_name,
            run_id=job.run_id
        )
        if job.compare_with_champ:
            service.compare_and_promote(
                model_registry_name=job.model_registry_name,
                primary_metric=job.metric,
                higher_is_better=job.higher_is_better
            )
