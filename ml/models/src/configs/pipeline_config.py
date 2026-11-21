from pydantic import BaseModel, Field
from typing import List


class Job(BaseModel):
    model_id: str = Field(
        ...,
        description="Unique identifier for the MLflow model"
    )
    run_id: str = Field(
        ...,
        description=(
            "Unique identifier for the MLflow run associated with the model"
        )
    )
    model_registry_name: str = Field(
        ...,
        description="Name of the model in the registry"
    )
    compare_with_champ: bool = Field(
        ...,
        description=(
            "Whether to compare this run against the current champion model"
        )
    )
    include_t_test: bool = Field(
        ...,
        description="Whether to include statistical t-test in the evaluation"
    )
    metric: str = Field(
        ...,
        description="Metric used for comparison (e.g., accuracy, f1)"
    )
    higher_is_better: bool = Field(
        ...,
        description="Defines whether a higher metric value is better"
    )


class PipelineConfig(BaseModel):
    jobs: List[Job] = Field(
        ...,
        description="List of jobs to execute"
    )
