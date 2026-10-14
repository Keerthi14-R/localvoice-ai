import time
import os
from typing import Dict, Any, Optional, Callable
from app.core.config import settings
from app.core.logging import logger

class TranscriptionService:
    _models: Dict[str, Any] = {}

    @classmethod
    def get_model(cls, model_name: Optional[str] = None):
        """Lazy model loader with in-memory caching."""
        name = model_name or settings.WHISPER_MODEL
        if name not in cls._models:
            from faster_whisper import WhisperModel
            logger.info(
                f"Loading Faster-Whisper model '{name}' (device={settings.WHISPER_DEVICE}, "
                f"compute_type={settings.WHISPER_COMPUTE_TYPE}, cpu_threads={settings.WHISPER_CPU_THREADS})..."
            )
            start_time = time.time()
            model = WhisperModel(
                model_size_or_path=name,
                device=settings.WHISPER_DEVICE,
                compute_type=settings.WHISPER_COMPUTE_TYPE,
                cpu_threads=settings.WHISPER_CPU_THREADS,
                num_workers=settings.WHISPER_NUM_WORKERS,
            )
            cls._models[name] = model
            logger.info(f"Model '{name}' loaded in {time.time() - start_time:.2f}s")
        return cls._models[name]

    @classmethod
    def list_cached_models(cls):
        return list(cls._models.keys())

    @classmethod
    def transcribe(
        cls,
        audio_path: str,
        language: Optional[str] = None,
        model_name: Optional[str] = None,
        progress_callback: Optional[Callable[[int], None]] = None,
        check_cancelled: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Any]:
        """
        Transcribe an audio file using Faster-Whisper.
        Provides genuine segments, detected language, and timing metrics.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = cls.get_model(model_name)
        lang_arg = language if language and language.strip().lower() != "auto" else None
        
        start_time = time.time()
        logger.info(f"Starting inference on audio file (language={lang_arg or 'auto'})...")

        try:
            segments_gen, info = model.transcribe(
                audio_path,
                language=lang_arg,
                beam_size=settings.WHISPER_BEAM_SIZE,
                vad_filter=settings.WHISPER_VAD_FILTER,
            )

            results = []
            audio_duration = float(info.duration) if info.duration else 0.0

            for seg in segments_gen:
                if check_cancelled and check_cancelled():
                    logger.info("Transcription cancelled by user request during segment processing.")
                    raise InterruptedError("Transcription cancelled by user.")

                segment_data = {
                    "id": len(results),
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "text": seg.text.strip(),
                }
                results.append(segment_data)

                # Report honest progress based on audio timestamps if duration is known
                if progress_callback and audio_duration > 0:
                    pct = min(99, int((seg.end / audio_duration) * 100))
                    progress_callback(pct)

            proc_time = round(time.time() - start_time, 2)
            rtf = round(proc_time / audio_duration, 3) if audio_duration > 0 else None
            full_text = " ".join(s["text"] for s in results).strip()

            logger.info(
                f"Transcription complete: {len(results)} segments, duration={audio_duration:.2f}s, "
                f"processing_time={proc_time:.2f}s, RTF={rtf or 'N/A'}"
            )

            return {
                "language": info.language,
                "language_probability": round(info.language_probability, 4) if info.language_probability else None,
                "duration": audio_duration,
                "processing_time": proc_time,
                "real_time_factor": rtf,
                "segments": results,
                "text": full_text
            }

        except InterruptedError:
            raise
        except Exception as e:
            logger.error(f"Inference error: {type(e).__name__}: {str(e)}")
            raise RuntimeError(f"Transcription failed: {str(e)}")
