import json
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.responses import PlainTextResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session
import asyncio

from app.db.database import get_db
from app.db.models import Job
from app.core.config import settings
from app.core.logging import logger
from app.schemas.transcription import (
    JobCreateResponse,
    JobResponse,
    JobDetailResponse,
    JobListResponse,
    JobUpdateRequest,
    SegmentSchema
)
from app.utils.filevalidation import (
    validate_file_extension,
    generate_safe_storage_path,
    stream_and_validate_upload,
)
from app.services.jobservice import JobService
from app.services.exportservice import (
    export_to_txt,
    export_to_srt,
    export_to_vtt
)
from app.workers.queue import job_queue

router = APIRouter(prefix="/transcriptions", tags=["Transcriptions"])

@router.post("", response_model=JobCreateResponse, status_code=202)
async def create_transcription(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Accepts audio upload, validates format and size, stores safely,
    creates background transcription job, and returns job ID immediately.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    ext = validate_file_extension(file.filename)
    job_id = str(uuid.uuid4())
    dest_path = generate_safe_storage_path(settings.audio_temp_dir, ext)
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

    total_bytes, sanitized_name = await stream_and_validate_upload(
        upload_file=file,
        dest_path=dest_path,
        max_bytes=max_bytes
    )

    chosen_model = model.strip() if model and model.strip() else settings.WHISPER_MODEL
    lang_val = language.strip() if language and language.strip().lower() != "auto" else None

    # Persist job metadata in SQLite
    job = JobService.create_job(
        db=db,
        job_id=job_id,
        filename=sanitized_name,
        display_name=sanitized_name,
        file_path=str(dest_path),
        file_size=total_bytes,
        model=chosen_model,
        language_requested=lang_val
    )

    # Enqueue job to background worker
    await job_queue.enqueue(job_id)

    return JobCreateResponse(
        id=job.id,
        filename=job.filename,
        display_name=job.display_name,
        status=job.status,
        created_at=job.created_at
    )

@router.get("", response_model=JobListResponse)
def list_transcriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
    db: Session = Depends(get_db)
):
    """List recent saved jobs with search, filtering, and pagination."""
    items, total = JobService.list_jobs(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        sort_by=sort_by,
        order=order
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    
    # Map to schema with has_audio computed
    result_items = []
    for item in items:
        resp = JobResponse.model_validate(item)
        resp.has_audio = bool(item.file_path)
        result_items.append(resp)

    return JobListResponse(
        items=result_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/{job_id}", response_model=JobDetailResponse)
def get_transcription(job_id: str, db: Session = Depends(get_db)):
    """Return job metadata, current status, and segments if complete."""
    job = JobService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    
    segments = []
    if job.segments:
        try:
            raw_segs = json.loads(job.segments)
            segments = [SegmentSchema(**s) for s in raw_segs]
        except Exception:
            pass

    resp = JobDetailResponse(
        id=job.id,
        filename=job.filename,
        display_name=job.display_name,
        status=job.status,
        progress=job.progress,
        model=job.model,
        language_requested=job.language_requested,
        language_detected=job.language_detected,
        language_probability=job.language_probability,
        duration=job.duration,
        processing_time=job.processing_time,
        real_time_factor=job.real_time_factor,
        text=job.text,
        edited_text=job.edited_text,
        has_audio=bool(job.file_path),
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
        segments=segments
    )
    return resp

@router.get("/{job_id}/events")
async def stream_job_events(job_id: str, db: Session = Depends(get_db)):
    """Server-Sent Events endpoint streaming live job status and progress updates."""
    job = JobService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")

    async def event_generator():
        # First send immediate current state
        yield {
            "event": "message",
            "data": json.dumps({"status": job.status, "progress": job.progress})
        }
        if job.status in ("completed", "failed", "cancelled"):
            return

        q = job_queue.register_listener(job_id)
        try:
            while True:
                try:
                    event_data = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield {
                        "event": "message",
                        "data": json.dumps(event_data)
                    }
                    if event_data.get("status") in ("completed", "failed", "cancelled"):
                        break
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat
                    yield {"event": "ping", "data": "heartbeat"}
        finally:
            job_queue.unregister_listener(job_id, q)

    return EventSourceResponse(event_generator())

@router.get("/{job_id}/result")
def get_transcription_result(job_id: str, db: Session = Depends(get_db)):
    """Return transcript text, detected language, and segments."""
    job = JobService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail=f"Job is not completed. Current status: {job.status}")

    segments = []
    if job.segments:
        try:
            segments = json.loads(job.segments)
        except Exception:
            pass

    return {
        "id": job.id,
        "language_detected": job.language_detected,
        "language_probability": job.language_probability,
        "duration": job.duration,
        "processing_time": job.processing_time,
        "real_time_factor": job.real_time_factor,
        "text": job.edited_text or job.text or "",
        "original_text": job.text or "",
        "edited_text": job.edited_text,
        "segments": segments
    }

@router.get("/{job_id}/export")
def export_transcription(
    job_id: str,
    format: str = Query("txt", pattern="^(txt|srt|vtt)$"),
    db: Session = Depends(get_db)
):
    """Export transcript as downloadable TXT, SRT, or WebVTT with correct timestamps."""
    job = JobService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Cannot export incomplete transcript.")

    segments = []
    if job.segments:
        try:
            segments = json.loads(job.segments)
        except Exception:
            pass

    safe_base = (job.display_name or job.filename or "transcript").rsplit(".", 1)[0]
    safe_base = "".join(c for c in safe_base if c.isalnum() or c in ("-", "_")).strip() or "transcript"

    if format == "txt":
        content = export_to_txt(job.text or "", job.edited_text)
        media_type = "text/plain; charset=utf-8"
        filename = f"{safe_base}.txt"
    elif format == "srt":
        content = export_to_srt(segments, fallback_text=job.edited_text or job.text or "")
        media_type = "application/x-subrip; charset=utf-8"
        filename = f"{safe_base}.srt"
    elif format == "vtt":
        content = export_to_vtt(segments, fallback_text=job.edited_text or job.text or "")
        media_type = "text/vtt; charset=utf-8"
        filename = f"{safe_base}.vtt"
    else:
        raise HTTPException(status_code=400, detail="Unsupported export format.")

    return Response(
        content=content.encode("utf-8"),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/{job_id}/cancel")
def cancel_transcription(job_id: str, db: Session = Depends(get_db)):
    """Request job cancellation."""
    job = JobService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")

    if job.status in ("completed", "failed", "cancelled"):
        return {"id": job.id, "status": job.status, "message": "Job is already finalized."}

    job_queue.request_cancellation(job_id)
    JobService.mark_cancelled(db, job_id)
    return {"id": job.id, "status": "cancelled", "message": "Job cancellation requested."}

@router.patch("/{job_id}", response_model=JobResponse)
def update_transcription(job_id: str, payload: JobUpdateRequest, db: Session = Depends(get_db)):
    """Rename job display name or update edited transcript text."""
    job = JobService.update_job_metadata(
        db=db,
        job_id=job_id,
        display_name=payload.display_name,
        edited_text=payload.edited_text
    )
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    resp = JobResponse.model_validate(job)
    resp.has_audio = bool(job.file_path)
    return resp

@router.get("/{job_id}/audio")
def get_job_audio(job_id: str, db: Session = Depends(get_db)):
    """Stream audio file for browser playback and timestamp seeking."""
    from pathlib import Path
    from fastapi.responses import FileResponse
    job = JobService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    if not job.file_path or not Path(job.file_path).exists():
        raise HTTPException(status_code=404, detail="Audio file no longer exists or was cleaned up.")
    return FileResponse(path=job.file_path, filename=job.filename)

@router.delete("/{job_id}")
def delete_transcription(job_id: str, db: Session = Depends(get_db)):
    """Delete a saved job and its associated audio file."""
    # If job is active, request cancellation first
    job_queue.request_cancellation(job_id)
    success = JobService.delete_job(db, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    return {"id": job_id, "deleted": True}

@router.delete("")
def delete_all_transcriptions(db: Session = Depends(get_db)):
    """Delete all finalized jobs (completed, failed, cancelled) and local temporary files."""
    count = JobService.delete_all_jobs(db)
    return {"deleted_count": count, "message": f"Successfully deleted {count} jobs."}
