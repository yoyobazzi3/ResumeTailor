"""ORM model for the education table."""
import uuid
from sqlalchemy import Integer, Text, DateTime, ForeignKey
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column
from app.models.user import Base


class Education(Base):
    __tablename__ = "education"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    institution: Mapped[str] = mapped_column(Text, nullable=False)
    degree: Mapped[str] = mapped_column(Text, nullable=False)
    field_of_study: Mapped[str] = mapped_column(Text, nullable=False)
    graduation_year: Mapped[int] = mapped_column(Integer, nullable=False)
    graduation_month: Mapped[str | None] = mapped_column(Text)
    gpa: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
