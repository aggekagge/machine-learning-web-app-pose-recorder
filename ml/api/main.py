from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from app.core.registry_instance import registry, deep_registry
from app.config import Settings
from app.core.model_type import ModelType
from app.routers import (
    health,
    predict,
    features,
    datasets
)
from dotenv import load_dotenv
from pathlib import Path

import urllib3
from urllib3.exceptions import InsecureRequestWarning
urllib3.disable_warnings(InsecureRequestWarning)

settings = Settings()
api_root_path = Path(__file__).resolve().parent
env_path = api_root_path / "ml.env"
if env_path.exists():
    print(f"Loading environment variables from {env_path}")
    load_dotenv(dotenv_path=env_path)


# -------------------------------
# Lifespan: initialize and cleanup
# -------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing models...")
    try:
        registry.register_model(
            ModelType.SCORE.value
        )
        registry.register_model(
            ModelType.WEAKEST_LINK.value,
        )
        print("Models registered successfully.")
    except Exception as exc:
        # Keep API alive for non-inference routes (e.g., datasets endpoints)
        # when MLflow config/models are missing in local dev.
        print(f"Model registration skipped: {exc}")
    try:
        deep_registry.register_model(
            ModelType.FRAME_CUTTER.value
        )
        deep_registry.register_model(
            ModelType.MOVENET_TO_2D_KINECT.value
        )
        deep_registry.register_model(
            ModelType.TWOD_KINECT_TO_3D_KINECT.value
        )
        deep_registry.register_model(
            ModelType.GOOD_BAD_EXERCISE.value
        )
        deep_registry.register_model(
            ModelType.RECORD_QUALITY.value
        )
        deep_registry.register_model(
            ModelType.DEEP_SCORE_MODEL.value
        )
        print("Deep models registered successfully.")
    except Exception as exc:
        print(f"Deep model registration skipped: {exc}")
    yield
    print("Shutting down resources")

# -------------------------------
# FastAPI app
# -------------------------------
app = FastAPI(
    title="ML Inference API",
    lifespan=lifespan
)


# -------------------------------
# Exception handlers
# -------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError
):
    return JSONResponse(
        status_code=422,
        content={
            "error": "ValidationError",
            "message": "Request body does not match the expected schema.",
            "details": exc.errors(),
        },
    )

# -------------------------------
# Include routers
# -------------------------------
app.include_router(health.router)
app.include_router(predict.router)
app.include_router(features.router)
app.include_router(datasets.router)
