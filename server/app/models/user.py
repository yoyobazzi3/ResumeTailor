"""ORM model for the users table.

Also defines DeclarativeBase, which all other models import from here so
SQLAlchemy's metadata object stays unified — Alembic needs a single metadata
to generate migrations that cover every table.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Integer, String, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    # The raw password is never stored — only the bcrypt hash.
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    # Optional profile fields — all required for PDF resume export.
    full_name: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    location: Mapped[str | None] = mapped_column(String(200))
    linkedin_url: Mapped[str | None] = mapped_column(Text)
    portfolio_url: Mapped[str | None] = mapped_column(Text)
    university: Mapped[str | None] = mapped_column(String(300))
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    skills_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
