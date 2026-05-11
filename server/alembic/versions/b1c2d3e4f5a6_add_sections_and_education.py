"""add_sections_and_education

Revision ID: b1c2d3e4f5a6
Revises: f0e9d8c7b6a5
Create Date: 2026-05-10 13:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'f0e9d8c7b6a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # User profile additions
    op.add_column('users', sa.Column('university', sa.String(300), nullable=True))
    op.add_column('users', sa.Column('graduation_year', sa.Integer(), nullable=True))

    # resume_sections table
    op.create_table(
        'resume_sections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_name', sa.Text(), nullable=False),
        sa.Column('job_title', sa.Text(), nullable=True),
        sa.Column('company_location', sa.Text(), nullable=True),
        sa.Column('start_date', sa.Text(), nullable=True),
        sa.Column('end_date', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # section_id FK on resume_bullets (nullable, CASCADE on delete)
    op.add_column('resume_bullets', sa.Column('section_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_resume_bullets_section_id',
        'resume_bullets', 'resume_sections',
        ['section_id'], ['id'],
        ondelete='CASCADE'
    )

    # education table
    op.create_table(
        'education',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('institution', sa.Text(), nullable=False),
        sa.Column('degree', sa.Text(), nullable=False),
        sa.Column('field_of_study', sa.Text(), nullable=False),
        sa.Column('graduation_year', sa.Integer(), nullable=False),
        sa.Column('gpa', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('education')
    op.drop_constraint('fk_resume_bullets_section_id', 'resume_bullets', type_='foreignkey')
    op.drop_column('resume_bullets', 'section_id')
    op.drop_table('resume_sections')
    op.drop_column('users', 'graduation_year')
    op.drop_column('users', 'university')
