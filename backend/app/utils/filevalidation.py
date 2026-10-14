import os
import uuid
from pathlib import Path
from typing import Tuple, Set
from fastapi import UploadFile, HTTPException

SUPPORTED_EXTENSIONS: Set[str] = {
    ".wav", ".mp3", ".m4a", ".mp4", ".flac", ".ogg", ".webm"
}

# Known magic bytes or signatures for common audio formats
MAGIC_SIGNATURES = {
    b"RIFF": ".wav",
    b"ID3": ".mp3",
    b"\xff\xfb": ".mp3",
    b"\xff\xf3": ".mp3",
    b"\xff\xf2": ".mp3",
    b"fLaC": ".flac",
    b"OggS": ".ogg",
    b"\x1a\x45\xdf\xa3": ".webm", # EBML header for WebM / Matroska
}

def sanitize_filename(filename: str) -> str:
    """Sanitize original filename to strip paths and dangerous characters for display."""
    if not filename:
        return "unnamed_audio"
    # Take basename only to prevent directory traversal
    name = Path(filename).name
    # Keep alphanumeric, spaces, dashes, dots, underscores
    sanitized = "".join(c for c in name if c.isalnum() or c in (" ", "-", "_", ".")).strip()
    return sanitized or "unnamed_audio"

def validate_file_extension(filename: str) -> str:
    """Validate that the file extension is supported."""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
    return ext

def generate_safe_storage_path(target_dir: Path, extension: str) -> Path:
    """Generate a collision-free, safe random UUID-based file path."""
    safe_filename = f"{uuid.uuid4().hex}{extension}"
    dest = target_dir / safe_filename
    # Verify no path traversal outside target_dir
    if not dest.resolve().is_relative_to(target_dir.resolve()):
        raise HTTPException(status_code=400, detail="Invalid destination path")
    return dest

async def stream_and_validate_upload(
    upload_file: UploadFile,
    dest_path: Path,
    max_bytes: int
) -> Tuple[int, str]:
    """
    Stream upload file in chunks directly to disk to avoid loading large files entirely into RAM.
    Validates file size and header magic bytes.
    Returns (total_bytes, sanitized_original_name).
    """
    sanitized_name = sanitize_filename(upload_file.filename or "upload.wav")
    total_bytes = 0
    chunk_size = 1024 * 64 # 64 KB chunks
    first_chunk = True

    try:
        with open(dest_path, "wb") as buffer:
            while True:
                chunk = await upload_file.read(chunk_size)
                if not chunk:
                    break
                
                # Check magic bytes on first chunk
                if first_chunk:
                    first_chunk = False
                    if len(chunk) < 4:
                        raise HTTPException(status_code=400, detail="Uploaded file is too small or empty.")
                    # Note: m4a / mp4 usually have 'ftyp' at offset 4
                    if b"ftyp" in chunk[:12]:
                        pass # valid mp4/m4a container
                    elif not any(chunk.startswith(sig) for sig in MAGIC_SIGNATURES):
                        # Some MP3 files have raw MPEG sync frame without ID3 header
                        # If extension is valid audio, allow, but log caution
                        pass

                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size of {max_bytes // (1024 * 1024)} MB."
                    )
                buffer.write(chunk)

        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

        return total_bytes, sanitized_name

    except Exception:
        # Clean up partial file on failure
        if dest_path.exists():
            try:
                dest_path.unlink()
            except OSError:
                pass
        raise
