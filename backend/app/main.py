import sys
from pathlib import Path
# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from app.core.config import settings
from app.core.logging import logger
from app.db.database import init_db, SessionLocal
from app.db.models import Job
from app.workers.queue import job_queue
from app.api.routes import health, settings as settings_route, transcriptions

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema
    logger.info(f"Initializing database at: {settings.resolved_database_url}")
    init_db()

    # Handle stale jobs from any ungraceful previous restart
    db = SessionLocal()
    try:
        stale_jobs = db.query(Job).filter(Job.status == "processing").all()
        for job in stale_jobs:
            job.status = "failed"
            job.error_message = "Server restarted while transcription was in progress."
            job.updated_at = datetime.utcnow()
        if stale_jobs:
            db.commit()
            logger.info(f"Marked {len(stale_jobs)} stale processing jobs as failed.")
    finally:
        db.close()

    # Start background transcription worker
    job_queue.start()
    logger.info(f"Application {settings.APP_NAME} started on {settings.HOST}:{settings.PORT}")

    yield

    # Shutdown: Stop worker gracefully
    await job_queue.stop()
    logger.info("Application shutdown complete.")

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Local-first audio transcription web application powered by Faster-Whisper.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers under /api
app.include_router(health.router, prefix="/api")
app.include_router(settings_route.router, prefix="/api")
app.include_router(transcriptions.router, prefix="/api")

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "running",
        "docs": "/docs",
        "health": "/api/health"
    }
