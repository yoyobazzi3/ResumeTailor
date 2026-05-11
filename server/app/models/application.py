"""ORM model for the applications table.

Represents one job application. The status_history relationship is declared
here with cascade="all, delete-orphan" so that deleting an application
automatically removes its history rows — no manual cleanup required.
"""

import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Boolean, String, Integer, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.user import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    company: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    job_url: Mapped[str | None] = mapped_column(Text)
    job_description: Mapped[str | None] = mapped_column(Text)
    # Valid values: saved | applied | phone_screen | technical | offer | rejected
    status: Mapped[str] = mapped_column(String, nullable=False, default="saved")
    # Populated after AI tailoring; null until the user runs Tailor Resume.
    match_score: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    applied_at: Mapped[date | None] = mapped_column(Date)
    # True while a background tailor task is in progress — cleared when the task finishes.
    is_tailoring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    status_history: Mapped[list["StatusHistory"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
