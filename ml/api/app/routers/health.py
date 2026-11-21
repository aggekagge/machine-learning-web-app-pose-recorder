from fastapi import APIRouter

"""
Endpoint for checking if server is active.
"""

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
def health_check():
    return {"status": "ok"}
