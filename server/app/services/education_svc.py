"""CRUD for education records."""
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.education import Education
from app.schemas.resume import EducationCreate, EducationUpdate


async def get_education(db: AsyncSession, user_id: uuid.UUID) -> list[Education]:
    result = await db.execute(
        select(Education)
        .where(Education.user_id == user_id)
        .order_by(Education.display_order, Education.created_at)
    )
    return list(result.scalars().all())


async def create_education_record(db: AsyncSession, user_id: uuid.UUID, payload: EducationCreate) -> Education:
    edu = Education(user_id=user_id, **payload.model_dump())
    db.add(edu)
    await db.commit()
    await db.refresh(edu)
    return edu


async def update_education_record(
    db: AsyncSession, user_id: uuid.UUID, education_id: uuid.UUID, payload: EducationUpdate
) -> Education:
    result = await db.execute(
        select(Education).where(Education.id == education_id, Education.user_id == user_id)
    )
    edu = result.scalar_one_or_none()
    if edu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Education record not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(edu, field, value)
    await db.commit()
    await db.refresh(edu)
    return edu


async def delete_education_record(db: AsyncSession, user_id: uuid.UUID, education_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Education).where(Education.id == education_id, Education.user_id == user_id)
    )
    edu = result.scalar_one_or_none()
    if edu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Education record not found")
    await db.delete(edu)
    await db.commit()
