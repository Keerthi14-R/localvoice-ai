from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

# Project root directory (localvoice-ai)
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "LocalVoice AI"
    APP_ENV: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    DATABASE_URL: str = "sqlite:///./storage/localvoice.db"
    STORAGE_DIR: str = "./storage"
    MAX_UPLOAD_MB: int = 25
    MAX_DURATION_MINUTES: int = 15
    KEEP_AUDIO_FILES: bool = False

    # Faster-Whisper Settings (CPU / INT8 optimized)
    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"
    WHISPER_CPU_THREADS: int = 2
    WHISPER_NUM_WORKERS: int = 1
    WHISPER_BEAM_SIZE: int = 1
    WHISPER_VAD_FILTER: bool = True
    MAX_CONCURRENT_TRANSCRIPTIONS: int = 1

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def resolved_storage_dir(self) -> Path:
        path = Path(self.STORAGE_DIR)
        if not path.is_absolute():
            path = BASE_DIR / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def audio_temp_dir(self) -> Path:
        d = self.resolved_storage_dir / "temp"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def resolved_database_url(self) -> str:
        # SQLite path resolution to absolute path
        if self.DATABASE_URL.startswith("sqlite:///./") or self.DATABASE_URL.startswith("sqlite:////"):
            raw_path = self.DATABASE_URL.replace("sqlite:///", "").replace("sqlite:////", "")
            p = Path(raw_path)
            if not p.is_absolute():
                p = (BASE_DIR / p).resolve()
            p.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{p.as_posix()}"
        return self.DATABASE_URL

settings = Settings()
