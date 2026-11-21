from argparse import ArgumentParser
from src.scripts.deploy import run_deploy_script
from src.mlflow_utils import load_credentials
from pathlib import Path

if "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--ml_flow_cred",
        type=str,
        help="path to .env file containing mlflow credentials"
    )
    parser.add_argument(
        "--config_file",
        type=str,
        required=True,
        help="file path to config file"
    )
    args = parser.parse_args()

    if args.ml_flow_cred:
        load_credentials(
            Path(args.ml_flow_cred)
        )

    run_deploy_script(args)
