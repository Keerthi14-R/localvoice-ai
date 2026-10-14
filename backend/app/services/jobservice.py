import json
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_
from app.db.models import Job
from app.utils.cleanup import safe_delete_file
from app.core.logging import logger

class JobService:
    @staticmethod
    def create_job(
        db: Session,
        job_id: str,
        filename: str,
        display_name: str,
        file_path: Optional[str],
        file_size: Optional[int],
        model: str,
        language_requested: Optional[str]
    ) -> Job:
        job = Job(
            id=job_id,
            filename=filename,
            display_name=display_name,
            file_path=file_path,
            file_size_bytes=file_size,
            status="queued",
            progress=0,
            model=model,
            language_requested=language_requested,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def get_job(db: Session, job_id: str) -> Optional[Job]:
        return db.query(Job).filter(Job.id == job_id).first()

    @staticmethod
    def list_jobs(
        db: Session,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        order: str = "desc"
    ) -> Tuple[List[Job], int]:
        query = db.query(Job)
        
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(or_(Job.display_name.ilike(term), Job.filename.ilike(term), Job.text.ilike(term)))
            
        if status and status.strip():
            query = query.filter(Job.status == status.strip())

        sort_col = getattr(Job, sort_by, Job.created_at)
        if order.lower() == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        total = query.count()
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    @staticmethod
    def update_job_metadata(
        db: Session,
        job_id: str,
        display_name: Optional[str] = None,
        edited_text: Optional[str] = None
    ) -> Optional[Job]:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return None
        if display_name is not None and display_name.strip():
            job.display_name = display_name.strip()
        if edited_text is not None:
            job.edited_text = edited_text
        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def mark_cancelled(db: Session, job_id: str) -> Optional[Job]:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return None
        if job.status in ("queued", "processing"):
            job.status = "cancelled"
            job.updated_at = datetime.utcnow()
            # Clean audio file if present
            if job.file_path:
                safe_delete_file(job.file_path)
                job.file_path = None
            db.commit()
            db.refresh(job)
        return job

    @staticmethod
    def delete_job(db: Session, job_id: str) -> bool:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return False
        if job.file_path:
            safe_delete_file(job.file_path)
        db.delete(job)
        db.commit()
        return True

    @staticmethod
    def delete_all_jobs(db: Session) -> int:
        """Delete all completed/failed/cancelled jobs and files, leaving currently active jobs alone."""
        jobs = db.query(Job).filter(Job.status.in_(["completed", "failed", "cancelled"])).all()
        count = 0
        for job in jobs:
            if job.file_path:
                safe_delete_file(job.file_path)
            db.delete(job)
            count += 1
        db.commit()
        return count
