"""CRUD for resume_sections."""
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.resume_section import ResumeSection
from app.schemas.resume import ResumeSectionCreate, ResumeSectionUpdate


async def get_sections(db: AsyncSession, user_id: uuid.UUID) -> list[ResumeSection]:
    result = await db.execute(
        select(ResumeSection)
        .options(selectinload(ResumeSection.bullets))
        .where(ResumeSection.user_id == user_id)
        .order_by(ResumeSection.display_order, ResumeSection.created_at)
    )
    sections = list(result.scalars().all())
    for s in sections:
        s.bullets.sort(key=lambda b: b.created_at)
    return sections


async def create_section(db: AsyncSession, user_id: uuid.UUID, payload: ResumeSectionCreate) -> ResumeSection:
    section = ResumeSection(user_id=user_id, **payload.model_dump())
    db.add(section)
    await db.commit()
    await db.refresh(section)
    # Load bullets relationship (empty for new section)
    result = await db.execute(
        select(ResumeSection)
        .options(selectinload(ResumeSection.bullets))
        .where(ResumeSection.id == section.id)
    )
    return result.scalar_one()


async def update_section(
    db: AsyncSession, user_id: uuid.UUID, section_id: uuid.UUID, payload: ResumeSectionUpdate
) -> ResumeSection:
    result = await db.execute(
        select(ResumeSection)
        .options(selectinload(ResumeSection.bullets))
        .where(ResumeSection.id == section_id, ResumeSection.user_id == user_id)
    )
    section = result.scalar_one_or_none()
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    await db.commit()
    await db.refresh(section)
    return section


async def delete_section(db: AsyncSession, user_id: uuid.UUID, section_id: uuid.UUID) -> None:
    result = await db.execute(
        select(ResumeSection).where(ResumeSection.id == section_id, ResumeSection.user_id == user_id)
    )
    section = result.scalar_one_or_none()
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    await db.delete(section)
    await db.commit()
