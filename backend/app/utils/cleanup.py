import os
from pathlib import Path
from typing import Optional, Set
from app.core.logging import logger

def safe_delete_file(file_path: Optional[str]) -> bool:
    """Safely delete a file without raising exceptions if it does not exist."""
    if not file_path:
        return False
    try:
        p = Path(file_path)
        if p.exists() and p.is_file():
            p.unlink()
            return True
    except Exception as e:
        logger.warning(f"Failed to remove file {file_path}: {e}")
    return False

def cleanup_stale_temp_files(temp_dir: Path, active_paths: Set[str]) -> int:
    """Clean up orphan audio files in temp directory that are not part of active jobs."""
    count = 0
    if not temp_dir.exists():
        return count
    active_resolved = {str(Path(p).resolve()) for p in active_paths if p}
    
    for f in temp_dir.glob("*"):
        if f.is_file() and str(f.resolve()) not in active_resolved:
            try:
                f.unlink()
                count += 1
            except Exception as e:
                logger.warning(f"Could not clean stale file {f}: {e}")
    return count
