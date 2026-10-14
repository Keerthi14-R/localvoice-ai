import asyncio
import json
from datetime import datetime
from typing import Dict, Set, Optional, AsyncGenerator
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Job
from app.services.transcription import TranscriptionService
from app.utils.cleanup import safe_delete_file
from app.core.config import settings
from app.core.logging import logger

class JobQueue:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        self.worker_task: Optional[asyncio.Task] = None
        self.active_job_id: Optional[str] = None
        self.cancelled_job_ids: Set[str] = set()
        # Event listeners for SSE: job_id -> set of asyncio.Queue
        self.listeners: Dict[str, Set[asyncio.Queue]] = {}
        self._running = False

    def start(self):
        if not self._running:
            self._running = True
            self.worker_task = asyncio.create_task(self._worker_loop())
            logger.info("Transcription background worker started.")

    async def stop(self):
        self._running = False
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
            logger.info("Transcription background worker stopped.")

    async def enqueue(self, job_id: str):
        await self.queue.put(job_id)
        await self._broadcast_event(job_id, {"status": "queued", "progress": 0})
        logger.info(f"Enqueued job {job_id} (queue size={self.queue.qsize()})")

    def request_cancellation(self, job_id: str):
        self.cancelled_job_ids.add(job_id)

    def is_cancelled(self, job_id: str) -> bool:
        return job_id in self.cancelled_job_ids

    def register_listener(self, job_id: str) -> asyncio.Queue:
        if job_id not in self.listeners:
            self.listeners[job_id] = set()
        q = asyncio.Queue(maxsize=100)
        self.listeners[job_id].add(q)
        return q

    def unregister_listener(self, job_id: str, q: asyncio.Queue):
        if job_id in self.listeners:
            self.listeners[job_id].discard(q)
            if not self.listeners[job_id]:
                del self.listeners[job_id]

    async def _broadcast_event(self, job_id: str, data: dict):
        if job_id in self.listeners:
            for q in list(self.listeners[job_id]):
                try:
                    q.put_nowait(data)
                except asyncio.QueueFull:
                    pass

    async def _worker_loop(self):
        while self._running:
            try:
                job_id = await self.queue.get()
                self.active_job_id = job_id

                if self.is_cancelled(job_id):
                    logger.info(f"Job {job_id} was cancelled before starting inference.")
                    self._mark_cancelled_in_db(job_id)
                    await self._broadcast_event(job_id, {"status": "cancelled", "progress": 0})
                    self.queue.task_done()
                    self.active_job_id = None
                    continue

                await self._process_job(job_id)
                self.queue.task_done()
                self.active_job_id = None

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error in worker loop: {e}", exc_info=True)
                await asyncio.sleep(1)

    async def _process_job(self, job_id: str):
        db: Session = SessionLocal()
        try:
            job: Optional[Job] = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                logger.warning(f"Job {job_id} not found in database for execution.")
                return

            if self.is_cancelled(job_id):
                job.status = "cancelled"
                db.commit()
                await self._broadcast_event(job_id, {"status": "cancelled"})
                return

            job.status = "processing"
            job.progress = 5
            job.updated_at = datetime.utcnow()
            db.commit()
            await self._broadcast_event(job_id, {"status": "processing", "progress": 5})

            # Define progress callback
            loop = asyncio.get_running_loop()
            def on_progress(pct: int):
                asyncio.run_coroutine_threadsafe(
                    self._update_progress_async(job_id, pct), loop
                )

            # Run Faster-Whisper in a thread pool to avoid blocking the event loop
            result = await asyncio.to_thread(
                TranscriptionService.transcribe,
                audio_path=job.file_path,
                language=job.language_requested,
                model_name=job.model,
                progress_callback=on_progress,
                check_cancelled=lambda: self.is_cancelled(job_id)
            )

            # Refresh job and store results
            db.refresh(job)
            job.status = "completed"
            job.progress = 100
            job.language_detected = result.get("language")
            job.language_probability = result.get("language_probability")
            job.duration = result.get("duration")
            job.processing_time = result.get("processing_time")
            job.real_time_factor = result.get("real_time_factor")
            job.text = result.get("text")
            job.segments = json.dumps(result.get("segments", []), ensure_ascii=False)
            job.completed_at = datetime.utcnow()

            # Clean audio file if KEEP_AUDIO_FILES is False
            if not settings.KEEP_AUDIO_FILES and job.file_path:
                safe_delete_file(job.file_path)
                job.file_path = None

            db.commit()
            logger.info(f"Job {job_id} successfully completed.")
            await self._broadcast_event(job_id, {"status": "completed", "progress": 100})

        except InterruptedError:
            logger.info(f"Job {job_id} interrupted and marked cancelled.")
            db.rollback()
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "cancelled"
                if job.file_path:
                    safe_delete_file(job.file_path)
                    job.file_path = None
                db.commit()
            await self._broadcast_event(job_id, {"status": "cancelled", "progress": 0})

        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            db.rollback()
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                if not settings.KEEP_AUDIO_FILES and job.file_path:
                    safe_delete_file(job.file_path)
                    job.file_path = None
                db.commit()
            await self._broadcast_event(job_id, {"status": "failed", "error": str(e)})

        finally:
            self.cancelled_job_ids.discard(job_id)
            db.close()

    async def _update_progress_async(self, job_id: str, pct: int):
        db = SessionLocal()
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job and job.status == "processing":
                job.progress = pct
                db.commit()
        except Exception:
            pass
        finally:
            db.close()
        await self._broadcast_event(job_id, {"status": "processing", "progress": pct})

    def _mark_cancelled_in_db(self, job_id: str):
        db = SessionLocal()
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "cancelled"
                if job.file_path:
                    safe_delete_file(job.file_path)
                    job.file_path = None
                db.commit()
        finally:
            db.close()

job_queue = JobQueue()
