from pydantic import BaseModel
from typing import List, Union, Dict, Any

"""
Pydantic models for machine learning prediction and API responses.

This module defines structured data models used for communication between
clients and a machine learning service. The models ensure consistent data
validation, serialization, and type safety using Pydantic.

Models:

- PredictionRequest:
    Represents the input payload sent to a machine learning model.
    Contains a list of numerical feature values used for
    generating predictions.

- PredictionResponse:
    Represents the model's prediction output.
    Includes the predicted value (numeric or categorical) and
    the version of the model that produced the result.

- FeatureResponse:
    Provides metadata about available input features.
    Includes a list of feature names and the total feature count.

- GenericResponse:
    Generic response model for generic tasks.
    Contains a task identifier and a flexible response payload
    that can hold arbitrary structured data.

Using Pydantic models ensures:
- Automatic validation of incoming and outgoing data
- Clear API contracts
- Type safety and better developer experience
"""


class PredictionRequest(BaseModel):
    features: List[float]


class PredictionResponse(BaseModel):
    prediction: Union[str, float]
    version: str


class FeatureResponse(BaseModel):
    features: List[str]
    count: int


class GenericResponse(BaseModel):
    task: str
    response: Dict[str, Any]
