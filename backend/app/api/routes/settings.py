from fastapi import APIRouter
from app.schemas.settings import SettingsResponse
from app.core.config import settings
from app.services.audioprocessing import is_ffmpeg_installed

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponse)
def get_settings():
    """Return safe, non-sensitive application settings for UI configuration."""
    return SettingsResponse(
        app_name=settings.APP_NAME,
        app_env=settings.APP_ENV,
        max_upload_mb=settings.MAX_UPLOAD_MB,
        max_duration_minutes=settings.MAX_DURATION_MINUTES,
        keep_audio_files=settings.KEEP_AUDIO_FILES,
        default_model=settings.WHISPER_MODEL,
        available_models=["tiny", "base", "small", "medium", "large-v3"],
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
        cpu_threads=settings.WHISPER_CPU_THREADS,
        max_concurrent_transcriptions=settings.MAX_CONCURRENT_TRANSCRIPTIONS,
        ffmpeg_available=is_ffmpeg_installed(),
    )
