"""Business logic for resume bullets and AI tailoring.

Bullet CRUD is straightforward. The tailor() function is the core feature:
it fetches the user's bullets and the application's job description, calls
Claude, stores the result, and updates the application's match_score in the
same transaction.
"""

import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.resume import ResumeBullet, TailoredResume
from app.models.application import Application
from app.models.resume_section import ResumeSection
from app.schemas.resume import BulletCreate
from app.services import sections as sections_svc
from app.services.claude import tailor_resume as claude_tailor


async def get_bullets_in_profile_order(db: AsyncSession, user_id: uuid.UUID) -> list[ResumeBullet]:
    """Bullets in the same order used for tailoring and PDF export: sections by display_order,
    then bullets by created_at within each section, then uncategorized bullets by created_at."""
    sections = await sections_svc.get_sections(db, user_id)
    ordered: list[ResumeBullet] = []
    for s in sections:
        for b in s.bullets:
            b.section = s
            ordered.append(b)
    orphan_result = await db.execute(
        select(ResumeBullet)
        .options(selectinload(ResumeBullet.section))
        .where(ResumeBullet.user_id == user_id, ResumeBullet.section_id.is_(None))
        .order_by(ResumeBullet.created_at)
    )
    ordered.extend(list(orphan_result.scalars().all()))
    return ordered


async def save_edited_bullets(
    db: AsyncSession, user_id: uuid.UUID, tailored_resume_id: uuid.UUID, edited_bullets: list[str]
) -> TailoredResume:
    """Persist user-edited bullets on a tailored resume record.

    Ownership is verified by joining through the application — a user cannot
    edit another user's tailored resume by guessing an ID.
    The original Claude output in tailored_bullets is never modified.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        tailored_resume_id: UUID of the tailored_resumes row to update.
        edited_bullets: New list of bullet strings to store.

    Returns:
        The updated TailoredResume ORM instance.

    Raises:
        HTTPException: 404 if the tailored resume does not exist or belongs to a different user.
    """
    result = await db.execute(
        select(TailoredResume)
        .join(Application, TailoredResume.application_id == Application.id)
        .where(
            TailoredResume.id == tailored_resume_id,
            Application.user_id == user_id,
        )
    )
    tailored = result.scalar_one_or_none()
    if tailored is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tailored resume not found")

    tailored.edited_bullets = edited_bullets
    await db.commit()
    await db.refresh(tailored)
    return tailored


async def get_bullets(db: AsyncSession, user_id: uuid.UUID) -> list[ResumeBullet]:
    """Return all resume bullets in profile order (sections, then orphans)."""
    return await get_bullets_in_profile_order(db, user_id)


async def create_bullet(
    db: AsyncSession, user_id: uuid.UUID, payload: BulletCreate
) -> ResumeBullet:
    """Insert a new resume bullet for the given user.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        payload: Validated request body with content and optional category.

    Returns:
        The newly created ResumeBullet ORM instance.
    """
    data = payload.model_dump()
    section_id = data.get("section_id")
    category = data.get("category")
    if section_id is not None:
        sec_result = await db.execute(
            select(ResumeSection).where(ResumeSection.id == section_id, ResumeSection.user_id == user_id)
        )
        sec = sec_result.scalar_one_or_none()
        if sec is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
        if not category:
            data["category"] = sec.category_name
    bullet = ResumeBullet(user_id=user_id, **data)
    db.add(bullet)
    await db.commit()
    await db.refresh(bullet)
    return bullet


async def delete_bullet(
    db: AsyncSession, user_id: uuid.UUID, bullet_id: uuid.UUID
) -> None:
    """Delete a single resume bullet.

    user_id is checked so a user cannot delete another user's bullets
    by guessing a UUID.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        bullet_id: UUID of the bullet to delete.

    Raises:
        HTTPException: 404 if the bullet does not exist or belongs to a different user.
    """
    result = await db.execute(
        select(ResumeBullet).where(
            ResumeBullet.id == bullet_id,
            ResumeBullet.user_id == user_id,
        )
    )
    bullet = result.scalar_one_or_none()
    if bullet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bullet not found")
    await db.delete(bullet)
    await db.commit()


async def tailor(
    db: AsyncSession, user_id: uuid.UUID, application_id: uuid.UUID
) -> TailoredResume:
    """Run AI tailoring for a given application and persist the result.

    Validates preconditions (application exists, has a job description,
    user has bullets), calls Claude, stores the tailored result, and
    writes the match_score back to the application row — all in one
    commit so the state is always consistent.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        application_id: UUID of the application to tailor for.

    Returns:
        The newly created TailoredResume ORM instance.

    Raises:
        HTTPException: 404 if the application is not found.
        HTTPException: 422 if the application has no job description or the user has no bullets.
        anthropic.APIError: Propagated from claude.py on network failures.
    """
    app_result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == user_id,
        )
    )
    application = app_result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    if not application.job_description:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Application has no job description — add one before tailoring",
        )

    bullets = await get_bullets_in_profile_order(db, user_id)
    if not bullets:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No resume bullets found — add some before tailoring",
        )

    bullet_texts = [b.content for b in bullets]
    ai_result = await claude_tailor(bullet_texts, application.job_description)

    tailored = TailoredResume(
        application_id=application_id,
        original_bullets=bullet_texts,
        tailored_bullets=ai_result["tailored_bullets"],
        missing_keywords=ai_result.get("missing_keywords", []),
        match_score=ai_result.get("match_score"),
        reasoning=ai_result.get("reasoning"),
    )
    db.add(tailored)

    # Mirror the score onto the application row so the dashboard card
    # can display it without querying tailored_resumes.
    application.match_score = ai_result.get("match_score")

    await db.commit()
    await db.refresh(tailored)
    return tailored


async def get_tailored(
    db: AsyncSession, user_id: uuid.UUID, application_id: uuid.UUID
) -> TailoredResume:
    """Return the most recent tailored resume for an application.

    The ownership check on the application is performed first so a user
    cannot fetch tailored results for another user's application.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        application_id: UUID of the application.

    Returns:
        The most recently created TailoredResume for the given application.

    Raises:
        HTTPException: 404 if the application is not found or has no tailored results yet.
    """
    app_result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == user_id,
        )
    )
    if app_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    result = await db.execute(
        select(TailoredResume)
        .where(TailoredResume.application_id == application_id)
        .order_by(TailoredResume.created_at.desc())
        .limit(1)
    )
    tailored = result.scalar_one_or_none()
    if tailored is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tailored resume found for this application",
        )
    return tailored
