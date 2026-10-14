from fastapi import APIRouter
from app.schemas.settings import HealthResponse
from app.core.config import settings
from app.services.audioprocessing import is_ffmpeg_installed
from app.services.transcription import TranscriptionService

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("", response_model=HealthResponse)
def get_health():
    """Health endpoint returning application status, engine info, and model availability."""
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version="1.0.0",
        whisper_engine="faster-whisper",
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
        ffmpeg_installed=is_ffmpeg_installed(),
        cached_models=TranscriptionService.list_cached_models()
    )
