import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, Boolean
from app.db.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    filename = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    file_path = Column(String(1024), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    
    # Status: queued, processing, completed, failed, cancelled
    status = Column(String(32), default="queued", index=True, nullable=False)
    progress = Column(Integer, default=0, nullable=False) # 0 to 100
    
    # Model and speech parameters
    model = Column(String(64), default="base", nullable=False)
    language_requested = Column(String(16), nullable=True)
    language_detected = Column(String(16), nullable=True)
    language_probability = Column(Float, nullable=True)
    
    # Timing and benchmark metrics
    duration = Column(Float, nullable=True) # audio length in seconds
    processing_time = Column(Float, nullable=True) # transcription wall-time in seconds
    real_time_factor = Column(Float, nullable=True) # processing_time / duration
    
    # Transcript text and segments (JSON)
    text = Column(Text, nullable=True)
    edited_text = Column(Text, nullable=True)
    segments = Column(Text, nullable=True)
    
    # Diagnostics
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
