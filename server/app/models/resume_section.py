"""ORM model for the resume_sections table.

Stores section-level metadata (job title, dates, location) that applies to a
group of resume bullets. Bullets link to sections via section_id on resume_bullets.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.user import Base


class ResumeSection(Base):
    __tablename__ = "resume_sections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category_name: Mapped[str] = mapped_column(Text, nullable=False)
    job_title: Mapped[str | None] = mapped_column(Text)
    company_location: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[str | None] = mapped_column(Text)
    end_date: Mapped[str | None] = mapped_column(Text)
    # experience | project | skills | other — controls PDF grouping and layout style.
    section_type: Mapped[str] = mapped_column(String(20), nullable=False, default="experience")
    # Comma-separated tech stack shown inline with the project name in the PDF.
    tech_stack: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    bullets: Mapped[list["ResumeBullet"]] = relationship(
        "ResumeBullet", back_populates="section", cascade="all, delete"
    )
