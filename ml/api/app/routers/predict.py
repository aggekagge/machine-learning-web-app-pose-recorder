from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.schemas import PredictionRequest, PredictionResponse
from app.services.inference import predict
from app.core.model_registry import Registry
from app.utils.utils import cut_movenet_frames
from app.dependencies.dependencies import (
     get_registry,
     get_deep_registry,
     get_csv_manager
)
from app.core.model_type import ModelType
from app.utils.utils import generate_model_input
from app.file_managers.file_manager import FileManager
from app.core.deep_model_registry import DeepModelRegistry
from app.file_managers.utils import load_csv_as_df
from io import BytesIO
import pandas as pd

router = APIRouter(prefix="/predict", tags=["inference"])


@router.post("/", response_model=PredictionResponse,
             summary="Generate prediction using Score model",
             description=(
                 "Generate a prediction using the **Score model**."
             ),
             response_description=(
                 "Prediction result from Score model"
             ),
             )
async def predict_endpoint(
    request: PredictionRequest,
    registry: Registry = Depends(get_registry)
):
    try:
        model = registry.get_model(ModelType.SCORE.value)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {e}")

    features = model.get_features()
    if features is None:
        raise HTTPException(
            status_code=404,
            detail="Model features non-existent")

    model_instance = model.get_model()
    if model_instance is None:
        raise HTTPException(
            status_code=404,
            detail="Model instance non-existent")

    if len(features) != len(request.features):
        raise HTTPException(
            status_code=400,
            detail="Number of features and feature values must be equal."
        )
    return predict(
        model_instance, generate_model_input(features, request.features)
        )


@router.post("/weakest_link", response_model=PredictionResponse,
             summary="Generate prediction using Weakest Link model",
             description=(
                 "Generate a prediction using the **Weakest Link model**."
                 ),
             response_description=(
                 "Prediction result from Weakest Link model"
                 ),)
async def weakest_link_endpoint(
    request: PredictionRequest,
    registry: Registry = Depends(get_registry)
):
    try:
        model = registry.get_model(ModelType.WEAKEST_LINK.value)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {e}")

    features = model.get_features()
    if features is None:
        raise HTTPException(
            status_code=404,
            detail="Model features non-existent")

    model_instance = model.get_model()
    if model_instance is None:
        raise HTTPException(
            status_code=404,
            detail="Model instance non-existent")

    if len(features) != len(request.features):
        raise HTTPException(
            status_code=400,
            detail="Number of features and feature values must be equal."
        )
    return predict(
        model_instance, generate_model_input(features, request.features)
        )


@router.get("/good_bad_exercise/{filename}")
async def good_bad_exercise_with_score(
        filename: str,
        file_manager: FileManager = Depends(get_csv_manager),
        registry: DeepModelRegistry = Depends(get_deep_registry)
):
    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files can be retrieved from this endpoint"
        )

    if not file_manager.file_exists(filename):
        raise HTTPException(
            status_code=404,
            detail=f"File '{filename}' not found"
        )

    try:
        model_evaluator = registry.get_model(ModelType.GOOD_BAD_EXERCISE.value)
        model_cutter = registry.get_model(ModelType.FRAME_CUTTER.value)
        model_scorer = registry.get_model(ModelType.DEEP_SCORE_MODEL.value)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {e}")

    file_path = file_manager._resolve_path(filename)
    movenet_df = load_csv_as_df(file_path)

    cuts = model_cutter.predict(movenet_df)
    movenet_df = cut_movenet_frames(
        movenet_df=movenet_df,
        frame_cutter_df=cuts
    )
    result = model_evaluator.predict(movenet_df)

    movenet_df_with_sequence_id = movenet_df.copy()
    movenet_df_with_sequence_id["sequence_id"] = "video_0"
    score_result = model_scorer.predict(movenet_df_with_sequence_id)
    return {
        "good_bad_pred": result.iloc[0].to_dict(),
        "score_pred": score_result.iloc[0].to_dict()
    }


@router.post("/record_quality")
async def record_quality(
    file: UploadFile = File(...),
    registry: DeepModelRegistry = Depends(get_deep_registry)
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are allowed"
        )

    try:
        content = await file.read()
        movenet_df = pd.read_csv(BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read CSV file: {e}"
        )

    movenet_df["sequence_id"] = "video_0"

    try:
        model_evaluator = registry.get_model(ModelType.RECORD_QUALITY.value)
    except KeyError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Model not found: {e}"
        )

    try:
        result = model_evaluator.predict(movenet_df)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {e}"
        )

    return {
        "record_quality_pred": result.iloc[0].to_dict()
    }
