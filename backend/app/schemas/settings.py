from pydantic import BaseModel
from typing import List, Optional

class SettingsResponse(BaseModel):
    app_name: str
    app_env: str
    max_upload_mb: int
    max_duration_minutes: int
    keep_audio_files: bool
    default_model: str
    available_models: List[str]
    device: str
    compute_type: str
    cpu_threads: int
    max_concurrent_transcriptions: int
    ffmpeg_available: bool

class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    whisper_engine: str
    device: str
    compute_type: str
    ffmpeg_installed: bool
    cached_models: List[str]
