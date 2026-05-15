"""Routes for job application CRUD.

Routers are intentionally thin — each handler validates inputs via the schema
and delegates all database logic to the service layer. This keeps routes
readable and the business logic independently testable.
"""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.dependencies.auth import get_current_user
from app.models.application import Application
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    ApplicationDetailResponse,
)
from app.services import applications as svc
from app.services import resume as resume_svc
from app.services import scraper as scraper_svc

router = APIRouter(prefix="/api/applications", tags=["applications"])

_logger = logging.getLogger(__name__)


async def _run_background_tailor(user_id: uuid.UUID, application_id: uuid.UUID) -> None:
    """Call the tailor service in a background task with its own DB session.

    On completion (success or failure), clears the is_tailoring flag so the
    dashboard card stops showing the pulsing indicator.
    """
    async with AsyncSessionLocal() as db:
        try:
            await resume_svc.tailor(db, user_id, application_id)
        except Exception as exc:
            _logger.warning("background_tailor_failed app=%s err=%s", application_id, exc)
        finally:
            # Direct UPDATE avoids identity-map stale-read issues after tailor()'s commit.
            await db.execute(
                sql_update(Application)
                .where(Application.id == application_id)
                .values(is_tailoring=False)
            )
            await db.commit()


@router.get("/", response_model=list[ApplicationResponse])
async def list_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all applications for the authenticated user.

    Uses the lightweight ApplicationResponse schema (no status_history)
    since the list view only needs card-level data.
    """
    return await svc.get_all(db, current_user.id)


@router.post("/", response_model=ApplicationResponse, status_code=201)
async def create_application(
    payload: ApplicationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new application and optionally trigger background AI tailoring.

    If a job_description is provided, is_tailoring is set to True immediately
    and the tailor task runs after the response is returned — the client sees the
    application right away without waiting for Claude.
    """
    app = await svc.create(db, current_user.id, payload)

    if payload.job_description and payload.job_description.strip():
        app.is_tailoring = True
        await db.commit()
        await db.refresh(app)
        background_tasks.add_task(_run_background_tailor, current_user.id, app.id)

    return app


@router.get("/{application_id}", response_model=ApplicationDetailResponse)
async def get_application(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single application with full detail including status history."""
    return await svc.get_one(db, current_user.id, application_id)


@router.patch("/{application_id}", response_model=ApplicationDetailResponse)
async def update_application(
    application_id: uuid.UUID,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partially update an application. Only provided fields are modified."""
    return await svc.update(db, current_user.id, application_id, payload)


@router.delete("/{application_id}", status_code=204)
async def delete_application(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an application and all its related records."""
    await svc.delete(db, current_user.id, application_id)


class ExtractJDRequest(BaseModel):
    url: str


@router.post("/extract-jd")
async def extract_jd(
    payload: ExtractJDRequest,
    current_user: User = Depends(get_current_user),
):
    """Fetch a public job posting URL and extract the job description, company, and role.

    Returns: {job_description, company, role} — company and role may be null.
    Raises 422 with a user-readable message on fetch or parse failures.
    """
    try:
        return await scraper_svc.fetch_job_info(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
