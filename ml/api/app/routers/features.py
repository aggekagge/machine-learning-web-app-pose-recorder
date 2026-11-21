# app/api/routes/features.py
from fastapi import APIRouter, Depends, HTTPException
from app.core.model_registry import Registry
from app.dependencies.dependencies import get_registry
from app.core.model_type import ModelType
from app.schemas import FeatureResponse


router = APIRouter(prefix="/features", tags=["health"])


@router.get("/weakest_link",
            summary="Get weakest link model features",
            description=(
                "Retrieve all features used by the Weakest Link model."
            ),
            response_description=(
                "Returns a list of weakest link model",
                " features and feature count."
            ))
def weakest_link_features(registry: Registry = Depends(get_registry)):
    try:
        model = registry.get_model(ModelType.WEAKEST_LINK.value)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {e}")
    features = model.get_features()
    if features is None:
        raise HTTPException(
            status_code=404,
            detail="Model features non-existent")
    return FeatureResponse(
        features=features,
        count=len(features)
    )


@router.get("/score_features",
            summary="Get score model features",
            description=(
                "Retrieve all features used by the Score model."
            ),
            response_description=(
                "Returns a list of Score model features and feature count."
            ))
def score_features(registry: Registry = Depends(get_registry)):
    try:
        model = registry.get_model(ModelType.SCORE.value)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {e}")
    features = model.get_features()
    if features is None:
        raise HTTPException(
            status_code=404,
            detail="Model features non-existent")
    return FeatureResponse(
        features=features,
        count=len(features)
    )
