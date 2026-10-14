from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SegmentSchema(BaseModel):
    id: Optional[int] = None
    start: float
    end: float
    text: str

class JobCreateResponse(BaseModel):
    id: str
    filename: str
    display_name: str
    status: str
    created_at: datetime

class JobResponse(BaseModel):
    id: str
    filename: str
    display_name: str
    status: str
    progress: int
    model: str
    language_requested: Optional[str] = None
    language_detected: Optional[str] = None
    language_probability: Optional[float] = None
    duration: Optional[float] = None
    processing_time: Optional[float] = None
    real_time_factor: Optional[float] = None
    text: Optional[str] = None
    edited_text: Optional[str] = None
    has_audio: bool = False
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class JobDetailResponse(JobResponse):
    segments: List[SegmentSchema] = []

class JobUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    edited_text: Optional[str] = None

class JobListResponse(BaseModel):
    items: List[JobResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
