"""Pydantic schemas for application request and response bodies.

Three response shapes exist deliberately:
- ApplicationResponse: lightweight, used by the list endpoint (no status_history join).
- ApplicationDetailResponse: extends the above, used by GET/PATCH single-item endpoints.
- StatusHistoryItem: nested inside ApplicationDetailResponse.

Keeping list and detail schemas separate avoids eager-loading status_history
for every card on the dashboard, which would be wasteful.
"""

from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import date, datetime


class ApplicationCreate(BaseModel):
    company: str
    role: str
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: str = "saved"
    notes: Optional[str] = None
    applied_at: Optional[date] = None


class ApplicationUpdate(BaseModel):
    """All fields are optional so callers can PATCH a single field at a time."""
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    job_description: Optional[str] = None
    notes: Optional[str] = None
    match_score: Optional[int] = None
    applied_at: Optional[date] = None


class ApplicationResponse(BaseModel):
    id: UUID4
    company: str
    role: str
    status: str
    match_score: Optional[int]
    applied_at: Optional[date]
    created_at: datetime
    # True while a background tailor task is running; clears once the result is stored.
    is_tailoring: bool = False

    # from_attributes=True lets Pydantic read values directly from SQLAlchemy
    # model instances rather than requiring a plain dict. Without this, every
    # route would need to call model.dict() manually before returning.
    model_config = {"from_attributes": True}


class StatusHistoryItem(BaseModel):
    id: UUID4
    status: str
    changed_at: datetime

    model_config = {"from_attributes": True}


class ApplicationDetailResponse(ApplicationResponse):
    """Extended response for single-application endpoints."""
    job_description: Optional[str]
    notes: Optional[str]
    job_url: Optional[str]
    # Default to empty list so the frontend never has to null-check this field.
    status_history: list[StatusHistoryItem] = []
