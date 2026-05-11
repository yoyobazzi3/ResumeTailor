"""add_edited_bullets_to_tailored_resumes

Revision ID: f0e9d8c7b6a5
Revises: a5b6c7d8e9f0
Create Date: 2026-05-10 12:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'f0e9d8c7b6a5'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tailored_resumes',
        sa.Column('edited_bullets', postgresql.JSONB(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('tailored_resumes', 'edited_bullets')
