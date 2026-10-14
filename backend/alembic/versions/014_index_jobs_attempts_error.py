"""014_index_jobs_attempts_error

Revision ID: 014_index_jobs_attempts_error
Revises: 013_knowledge_indexing_and_rag
Create Date: 2026-10-14 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '014_index_jobs_attempts_error'
down_revision: Union[str, None] = '013_knowledge_indexing_and_rag'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('index_jobs', sa.Column('attempts', sa.Integer(), server_default='0', nullable=False))
    op.add_column('index_jobs', sa.Column('error', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('index_jobs', 'error')
    op.drop_column('index_jobs', 'attempts')
