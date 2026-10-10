"""Add AI logging table and search requirement column

Revision ID: 004_ai_service_layer
Revises: 003_suppliers_and_storefront
Create Date: 2026-10-10 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004_ai_service_layer'
down_revision: Union[str, None] = '003_suppliers_and_storefront'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add requirement column to ai_searches
    op.add_column('ai_searches', sa.Column('requirement', postgresql.JSONB(), nullable=True))

    # Create ai_logs table for comprehensive telemetry and usage tracking
    op.create_table(
        'ai_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('feature_name', sa.String(100), nullable=False),
        sa.Column('prompt_name', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('latency_ms', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('completion_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('success', sa.Integer(), server_default='1', nullable=False),
        sa.Column('fallback', sa.Integer(), server_default='0', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_ai_logs_feature', 'ai_logs', ['feature_name'])
    op.create_index('idx_ai_logs_created_at', 'ai_logs', ['created_at'])


def downgrade() -> None:
    op.drop_index('idx_ai_logs_created_at', table_name='ai_logs')
    op.drop_index('idx_ai_logs_feature', table_name='ai_logs')
    op.drop_table('ai_logs')
    op.drop_column('ai_searches', 'requirement')
