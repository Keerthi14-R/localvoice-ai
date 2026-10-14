import shutil
import subprocess
from pathlib import Path
from typing import Optional, Tuple
from app.core.logging import logger

def is_ffmpeg_installed() -> bool:
    """Check if ffmpeg executable is available in PATH."""
    return shutil.which("ffmpeg") is not None

def get_audio_info(file_path: Path) -> Tuple[Optional[float], Optional[int]]:
    """
    Get duration in seconds and sample rate using soundfile or ffprobe if available.
    Returns (duration_seconds, sample_rate).
    """
    # 1. Try soundfile first (works for wav, flac, ogg)
    try:
        import soundfile as sf
        info = sf.info(str(file_path))
        return float(info.duration), int(info.samplerate)
    except Exception:
        pass

    # 2. Try ffprobe if installed
    if shutil.which("ffprobe"):
        try:
            cmd = [
                "ffprobe", "-v", "error", "-show_entries",
                "format=duration:stream=sample_rate",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(file_path)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                lines = [l.strip() for l in res.stdout.strip().splitlines() if l.strip()]
                duration = None
                sr = None
                for line in lines:
                    try:
                        val = float(line)
                        if duration is None:
                            duration = val
                        else:
                            sr = int(val)
                    except ValueError:
                        continue
                return duration, sr
        except Exception as e:
            logger.debug(f"ffprobe failed for {file_path.name}: {e}")

    # Fallback: Faster-whisper internally handles decoding via PyAV
    return None, None
