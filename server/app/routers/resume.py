"""Routes for resume bullets, PDF upload, and AI tailoring.

The tailor and upload endpoints both make Anthropic API calls. FastAPI's async
support means these calls yield the event loop while waiting — the server
remains responsive to other requests during Claude's response time.
"""

import io
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.application import Application
from app.models.resume import ResumeBullet, TailoredResume
from app.models.resume_section import ResumeSection
from app.models.user import User
from app.schemas.resume import (
    BulletCreate,
    BulletsEditRequest,
    BulletResponse,
    EducationCreate,
    EducationResponse,
    EducationUpdate,
    ResumeSectionCreate,
    ResumeSectionResponse,
    ResumeSectionUpdate,
    ResumeUploadResponse,
    UploadPreview,
    UploadPreviewEducation,
    UploadPreviewExperience,
    UploadPreviewProject,
    TailorRequest,
    TailoredResumeResponse,
)
from app.services import education_svc as edu_svc
from app.services import resume as svc
from app.services import sections as sections_svc
from app.services.claude import parse_resume
from app.services.pdf import extract_text_from_pdf
from app.services.resume_pdf import generate_resume_pdf, group_bullets_for_pdf

router = APIRouter(prefix="/api/resume", tags=["resume"])

_logger = logging.getLogger(__name__)

# Reject PDFs where extraction yields fewer characters than this — likely a
# scanned image that pypdf cannot read as text.
MIN_EXTRACTED_CHARS = 100


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume_pdf(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ingest a PDF resume and populate work experience, projects, education, and skills.

    Flow:
      1. Validate PDF content-type.
      2. Extract text from PDF bytes (rejects scanned images).
      3. Send to Claude → structured JSON with work_experience, projects, education, skills.
      4. Save each work experience entry as a resume_section (section_type="work_experience")
         with its bullets as resume_bullets rows.
      5. Save each project as a resume_section (section_type="project") with bullets.
      6. Save education rows, skipping duplicates (same institution).
      7. Build a skills_summary string and save it to the user profile.
      8. Return structured import summary.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be a PDF")

    # ── Step 1: extract text ──────────────────────────────────────────────────
    file_bytes = await file.read()
    try:
        extracted = extract_text_from_pdf(file_bytes)
    except Exception as exc:
        _logger.warning("resume_pdf_read_failed user=%s err=%s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not read this PDF file. It may be corrupted.",
        ) from exc

    _logger.info("resume_pdf_extracted user=%s chars=%d", current_user.id, len(extracted))

    if len(extracted.strip()) < MIN_EXTRACTED_CHARS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract readable text from this PDF. Make sure it is a text-based PDF and not a scanned image.",
        )

    # ── Step 2: Claude parsing ────────────────────────────────────────────────
    try:
        parsed = await parse_resume(extracted)
    except ValueError as exc:
        _logger.error("resume_parse_failed user=%s err=%s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume parsing failed — Claude returned an unexpected response. Try again or contact support.",
        ) from exc

    work_experience_list = parsed.get("work_experience") or []
    projects_list = parsed.get("projects") or []
    education_list = parsed.get("education") or []
    skills_dict = parsed.get("skills") or {}

    # ── Step 3: save to database ──────────────────────────────────────────────
    from app.models.education import Education

    try:
        total_bullets = 0
        we_order = 0

        # A. Work experience sections
        for item in work_experience_list:
            if not isinstance(item, dict):
                continue
            company = (item.get("company") or "").strip()
            if not company:
                continue
            sec = ResumeSection(
                user_id=current_user.id,
                category_name=company,
                job_title=(item.get("job_title") or "").strip() or None,
                company_location=(item.get("location") or "").strip() or None,
                start_date=(item.get("start_date") or "").strip() or None,
                end_date=(item.get("end_date") or "").strip() or None,
                section_type="work_experience",
                tech_stack=None,
                display_order=we_order,
            )
            we_order += 1
            db.add(sec)
            await db.flush()
            for bullet in (item.get("bullets") or []):
                text = str(bullet).strip()
                if text:
                    db.add(ResumeBullet(
                        user_id=current_user.id,
                        content=text,
                        category=company,
                        section_id=sec.id,
                    ))
                    total_bullets += 1

        # B. Project sections
        proj_order = we_order
        for item in projects_list:
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or "").strip()
            if not name:
                continue
            raw_stack = item.get("tech_stack") or []
            if isinstance(raw_stack, list):
                stack_str = ", ".join(str(t).strip() for t in raw_stack if str(t).strip())
            else:
                stack_str = str(raw_stack).strip()
            sec = ResumeSection(
                user_id=current_user.id,
                category_name=name,
                job_title=None,
                company_location=None,
                start_date=(item.get("start_date") or "").strip() or None,
                end_date=(item.get("end_date") or "").strip() or None,
                section_type="project",
                tech_stack=stack_str or None,
                display_order=proj_order,
            )
            proj_order += 1
            db.add(sec)
            await db.flush()
            for bullet in (item.get("bullets") or []):
                text = str(bullet).strip()
                if text:
                    db.add(ResumeBullet(
                        user_id=current_user.id,
                        content=text,
                        category=name,
                        section_id=sec.id,
                    ))
                    total_bullets += 1

        # C. Education — skip exact institution duplicates
        edu_imported = 0
        for edu_data in education_list:
            if not isinstance(edu_data, dict):
                continue
            institution = (edu_data.get("institution") or "").strip()
            degree = (edu_data.get("degree") or "").strip()
            field = (edu_data.get("field_of_study") or "").strip()
            grad_year = edu_data.get("graduation_year")
            if not institution or not degree or not field:
                continue
            try:
                grad_year = int(grad_year) if grad_year is not None else None
            except (TypeError, ValueError):
                grad_year = None
            existing = await db.execute(
                select(Education).where(
                    Education.user_id == current_user.id,
                    Education.institution == institution,
                )
            )
            if existing.scalar_one_or_none() is not None:
                _logger.info("edu_dedup_skip user=%s institution=%s", current_user.id, institution)
                continue
            raw_month = (edu_data.get("graduation_month") or "").strip() or None
            db.add(Education(
                user_id=current_user.id,
                institution=institution,
                degree=degree,
                field_of_study=field,
                graduation_year=grad_year or 0,
                graduation_month=raw_month,
                gpa=(edu_data.get("gpa") or None),
                display_order=edu_imported,
            ))
            edu_imported += 1

        # D. Skills summary — build formatted string and save to user profile
        skills_summary: str | None = None
        if isinstance(skills_dict, dict):
            parts: list[str] = []
            mapping = [
                ("Languages", "languages"),
                ("Frontend", "frontend"),
                ("Backend", "backend"),
                ("Databases", "databases"),
                ("Tools", "tools"),
            ]
            for label, key in mapping:
                vals = [str(v).strip() for v in (skills_dict.get(key) or []) if str(v).strip()]
                if vals:
                    parts.append(f"{label}: {', '.join(vals)}")
            if parts:
                skills_summary = " | ".join(parts)
                current_user.skills_summary = skills_summary
                db.add(current_user)

        await db.commit()

    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        _logger.error("resume_upload_db_failed user=%s\n%s", current_user.id, traceback.format_exc())
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Database save failed: {exc}",
        ) from exc

    # ── Step 4: build response ────────────────────────────────────────────────
    preview_exp = [
        UploadPreviewExperience(
            company=(item.get("company") or "").strip(),
            job_title=(item.get("job_title") or "").strip(),
        )
        for item in work_experience_list
        if isinstance(item, dict) and (item.get("company") or "").strip()
    ]
    preview_proj = [
        UploadPreviewProject(
            name=(item.get("name") or "").strip(),
            tech_stack=[str(t).strip() for t in (item.get("tech_stack") or []) if str(t).strip()],
        )
        for item in projects_list
        if isinstance(item, dict) and (item.get("name") or "").strip()
    ]
    preview_edu = [
        UploadPreviewEducation(
            institution=(edu.get("institution") or "").strip(),
            degree=(edu.get("degree") or "").strip(),
            graduation_year=int(edu["graduation_year"]) if edu.get("graduation_year") else None,
        )
        for edu in education_list
        if isinstance(edu, dict) and (edu.get("institution") or "").strip()
    ]

    return ResumeUploadResponse(
        work_experience_imported=len(preview_exp),
        projects_imported=len(preview_proj),
        education_imported=edu_imported,
        skills_parsed=bool(skills_summary),
        total_bullets_imported=total_bullets,
        skills_summary=skills_summary,
        preview=UploadPreview(
            work_experience=preview_exp,
            projects=preview_proj,
            education=preview_edu,
        ),
    )


@router.get("/bullets", response_model=list[BulletResponse])
async def list_bullets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all resume bullets for the authenticated user."""
    return await svc.get_bullets(db, current_user.id)


@router.post("/bullets", response_model=BulletResponse, status_code=201)
async def add_bullet(
    payload: BulletCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a single resume bullet to the authenticated user's profile."""
    return await svc.create_bullet(db, current_user.id, payload)


@router.delete("/bullets/{bullet_id}", status_code=204)
async def remove_bullet(
    bullet_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a resume bullet owned by the authenticated user."""
    await svc.delete_bullet(db, current_user.id, bullet_id)


@router.get("/sections", response_model=list[ResumeSectionResponse])
async def list_resume_sections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await sections_svc.get_sections(db, current_user.id)


@router.post("/sections", response_model=ResumeSectionResponse, status_code=201)
async def create_resume_section(
    payload: ResumeSectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await sections_svc.create_section(db, current_user.id, payload)


@router.patch("/sections/{section_id}", response_model=ResumeSectionResponse)
async def update_resume_section(
    section_id: uuid.UUID,
    payload: ResumeSectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await sections_svc.update_section(db, current_user.id, section_id, payload)


@router.delete("/sections/{section_id}", status_code=204)
async def delete_resume_section(
    section_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await sections_svc.delete_section(db, current_user.id, section_id)


@router.get("/education", response_model=list[EducationResponse])
async def list_education(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await edu_svc.get_education(db, current_user.id)


@router.post("/education", response_model=EducationResponse, status_code=201)
async def create_education(
    payload: EducationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await edu_svc.create_education_record(db, current_user.id, payload)


@router.patch("/education/{education_id}", response_model=EducationResponse)
async def update_education(
    education_id: uuid.UUID,
    payload: EducationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await edu_svc.update_education_record(db, current_user.id, education_id, payload)


@router.delete("/education/{education_id}", status_code=204)
async def delete_education(
    education_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await edu_svc.delete_education_record(db, current_user.id, education_id)


@router.post("/tailor", response_model=TailoredResumeResponse)
async def tailor_resume(
    payload: TailorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run AI tailoring for the given application and return the result.

    Calls Claude with the user's bullets and the application's job description.
    Expect ~5 seconds of latency while the model responds.
    """
    return await svc.tailor(db, current_user.id, payload.application_id)


@router.patch("/tailored/{tailored_resume_id}", response_model=TailoredResumeResponse)
async def update_tailored_bullets(
    tailored_resume_id: uuid.UUID,
    payload: BulletsEditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save user-edited bullets on an existing tailored resume record.

    The original Claude output (tailored_bullets) is never overwritten —
    only edited_bullets is updated, so the user can always reset to Claude's version.
    """
    return await svc.save_edited_bullets(db, current_user.id, tailored_resume_id, payload.edited_bullets)


@router.get("/tailored/{application_id}", response_model=TailoredResumeResponse)
async def get_tailored_resume(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent tailored resume for the given application."""
    return await svc.get_tailored(db, current_user.id, application_id)


@router.get("/export/{tailored_resume_id}")
async def export_resume_pdf(
    tailored_resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and stream an ATS-safe PDF resume for the given tailored resume.

    Uses edited_bullets if the user has made edits, otherwise tailored_bullets.
    Layout metadata comes from resume_sections; bullets must still match
    tailored.original_bullets in profile order or the client is asked to re-tailor.
    """
    # Verify ownership by joining through application.
    tr_result = await db.execute(
        select(TailoredResume, Application)
        .join(Application, TailoredResume.application_id == Application.id)
        .where(
            TailoredResume.id == tailored_resume_id,
            Application.user_id == current_user.id,
        )
    )
    row = tr_result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tailored resume not found")

    tailored, application = row

    export_lines: list[str] = tailored.edited_bullets or tailored.tailored_bullets
    orig = tailored.original_bullets

    ordered = await svc.get_bullets_in_profile_order(db, current_user.id)
    if len(ordered) != len(orig) or len(export_lines) != len(orig):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Your profile bullets changed since this tailoring. Please run Tailor again.",
        )
    for i, b in enumerate(ordered):
        if b.content != orig[i]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Your profile bullets changed since this tailoring. Please run Tailor again.",
            )

    education_rows = await edu_svc.get_education(db, current_user.id)
    pdf_sections = group_bullets_for_pdf(ordered, export_lines)
    try:
        pdf_bytes = generate_resume_pdf(current_user, pdf_sections, education_rows)
    except Exception as exc:
        _logger.exception("resume_pdf_export_failed tailored_resume_id=%s", tailored_resume_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate PDF. Rebuild the server image if you recently changed PDF dependencies.",
        ) from exc

    company = application.company.lower().replace(" ", "_")
    role = application.role.lower().replace(" ", "_")
    filename = f"resume_{company}_{role}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
