"""017_ai_msg_observability

Revision ID: 017_ai_msg_observability
Revises: 016_supp_cat_exchange_rates
Create Date: 2026-10-29 10:20:00.000000

Prompt 30: Observability fields on ai_messages
- model
- latency_ms
- fallback_reason
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '017_ai_msg_observability'
down_revision: Union[str, None] = '016_supp_cat_exchange_rates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ai_messages', sa.Column('model', sa.String(100), nullable=True))
    op.add_column('ai_messages', sa.Column('latency_ms', sa.Integer(), nullable=True))
    op.add_column('ai_messages', sa.Column('fallback_reason', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('ai_messages', 'fallback_reason')
    op.drop_column('ai_messages', 'latency_ms')
    op.drop_column('ai_messages', 'model')
