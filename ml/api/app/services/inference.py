from app.schemas import PredictionResponse
from pandas import DataFrame


def predict(model, input: DataFrame) -> PredictionResponse:
    """Return the model's prediction for the given request."""
    prediction = model.predict(input)[0]
    return PredictionResponse(
        prediction=prediction,
        version=getattr(model, "version", "champion_model")
    )
