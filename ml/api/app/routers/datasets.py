from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from app.dependencies.dependencies import get_csv_manager, get_deep_registry
from app.core.deep_model_registry import DeepModelRegistry
from app.file_managers.file_manager import FileManager
from app.file_managers.utils import load_csv_as_df
from app.core.model_type import ModelType
from app.utils.utils import cut_movenet_frames
from io import StringIO

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/csv/save")
async def save_csv(
    file: UploadFile = File(...),
    file_manager: FileManager = Depends(get_csv_manager)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are allowed"
        )

    content = await file.read()
    saved_path = file_manager.save_file(file.filename, content)

    return {
        "status": "saved",
        "filename": file.filename,
        "path": str(saved_path)
    }


@router.get("/csv/{filename}")
async def get_csv_file(
    filename: str,
    to_kinect: bool = Query(True),
    cut_frames: bool = Query(True),
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

    file_path = file_manager._resolve_path(filename)
    if not to_kinect and not cut_frames:
        return FileResponse(
            path=file_path,
            media_type="text/csv",
            filename=filename
        )

    movenet_df = load_csv_as_df(file_path)
    if cut_frames:
        frame_cutter = registry.get_model(ModelType.FRAME_CUTTER.value)
        cuts = frame_cutter.predict(movenet_df)
        movenet_df = cut_movenet_frames(
            movenet_df=movenet_df,
            frame_cutter_df=cuts
        )

    if not to_kinect:
        csv_buffer = StringIO()
        movenet_df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)

        output_filename = (
            filename.replace(".csv", "_cut.csv") if cut_frames else filename
        )
        return StreamingResponse(
            csv_buffer,
            media_type="text/csv",
            headers={
                "Content-Disposition":
                f'attachment; filename="{output_filename}"'
            }
        )

    movenet_to_2d = registry.get_model(ModelType.MOVENET_TO_2D_KINECT.value)
    twod_to_3d = registry.get_model(ModelType.TWOD_KINECT_TO_3D_KINECT.value)

    twod_kinect = movenet_to_2d.predict(movenet_df)
    threed_kinect = twod_to_3d.predict(twod_kinect)

    csv_buffer = StringIO()
    threed_kinect.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    output_filename = filename.replace(".csv", "_3d_kinect.csv")
    return StreamingResponse(
        csv_buffer,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{output_filename}"'
        }
    )


@router.get("/list_csv_files")
async def list_files(
    file_manager: FileManager = Depends(get_csv_manager)
):
    return {
        "files": file_manager.list_files()
    }
