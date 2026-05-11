"""add_section_type_and_tech_stack

Revision ID: e1f2a3b4c5d6
Revises: b1c2d3e4f5a6
Create Date: 2026-05-10 14:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('resume_sections', sa.Column(
        'section_type', sa.String(20), nullable=False, server_default='experience'
    ))
    op.add_column('resume_sections', sa.Column('tech_stack', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('resume_sections', 'tech_stack')
    op.drop_column('resume_sections', 'section_type')
