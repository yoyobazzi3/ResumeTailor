"""add_user_profile_fields_and_is_tailoring

Revision ID: a5b6c7d8e9f0
Revises: 2e04c11fa680
Create Date: 2026-05-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, None] = '2e04c11fa680'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('full_name', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('phone', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('location', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('linkedin_url', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('portfolio_url', sa.Text(), nullable=True))
    op.add_column('applications', sa.Column('is_tailoring', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('applications', 'is_tailoring')
    op.drop_column('users', 'portfolio_url')
    op.drop_column('users', 'linkedin_url')
    op.drop_column('users', 'location')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'full_name')
