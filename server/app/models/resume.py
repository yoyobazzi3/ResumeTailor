"""ORM models for resume_bullets and tailored_resumes tables.

ResumeBullet stores a user's master resume bullet points — the raw input to the AI.
TailoredResume stores one AI-generated result per tailoring run. Multiple results
can exist for the same application (one per run), and the most recent is served.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Integer, Text, DateTime, ForeignKey, ARRAY, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.user import Base


class ResumeBullet(Base):
    __tablename__ = "resume_bullets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional grouping label (e.g. "GoFundMe", "Skills") to help users organize bullets.
    category: Mapped[str | None] = mapped_column(Text)
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resume_sections.id", ondelete="CASCADE")
    )
    section: Mapped["ResumeSection | None"] = relationship("ResumeSection", back_populates="bullets")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class TailoredResume(Base):
    __tablename__ = "tailored_resumes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    # JSONB is used instead of a join table because the bullets are ordered lists
    # that are always read together — JSONB avoids unnecessary joins and preserves order.
    original_bullets: Mapped[list] = mapped_column(JSONB, nullable=False)
    tailored_bullets: Mapped[list] = mapped_column(JSONB, nullable=False)
    # PostgreSQL native ARRAY type for keywords; simpler to filter than JSONB for string lists.
    missing_keywords: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    match_score: Mapped[int | None] = mapped_column(Integer)
    # One-sentence explanation from Claude about why the score is what it is.
    reasoning: Mapped[str | None] = mapped_column(Text)
    # User-edited version of tailored_bullets — only set after the user modifies bullets.
    # NULL means the user has not edited; use tailored_bullets in that case.
    edited_bullets: Mapped[list | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
