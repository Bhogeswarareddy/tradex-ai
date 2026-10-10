"""Add RFQ workflow columns and Quotation extensions

Revision ID: 005_rfq_workflow
Revises: 004_ai_service_layer
Create Date: 2026-10-10 18:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '005_rfq_workflow'
down_revision: Union[str, None] = '004_ai_service_layer'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to rfqs table
    op.add_column('rfqs', sa.Column('product', sa.String(length=255), nullable=True))
    op.add_column('rfqs', sa.Column('category', sa.String(length=100), nullable=True))
    op.add_column('rfqs', sa.Column('rfq_deadline', sa.Date(), nullable=True))
    op.add_column('rfqs', sa.Column('delivery_deadline', sa.Date(), nullable=True))
    op.add_column('rfqs', sa.Column('payment_terms', sa.String(length=150), nullable=True))
    op.add_column('rfqs', sa.Column('specifications', postgresql.JSONB(), nullable=True))
    op.add_column('rfqs', sa.Column('quality_requirements', sa.Text(), nullable=True))
    op.add_column('rfqs', sa.Column('required_certifications', postgresql.JSONB(), nullable=True))
    op.add_column('rfqs', sa.Column('attachments', postgresql.JSONB(), nullable=True))

    # Add new columns to quotations table
    op.add_column('quotations', sa.Column('moq', sa.Integer(), nullable=True))
    op.add_column('quotations', sa.Column('currency', sa.String(length=10), server_default='EUR', nullable=False))
    op.add_column('quotations', sa.Column('attachments', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    # Remove columns from quotations table
    op.drop_column('quotations', 'attachments')
    op.drop_column('quotations', 'currency')
    op.drop_column('quotations', 'moq')

    # Remove columns from rfqs table
    op.drop_column('rfqs', 'attachments')
    op.drop_column('rfqs', 'required_certifications')
    op.drop_column('rfqs', 'quality_requirements')
    op.drop_column('rfqs', 'specifications')
    op.drop_column('rfqs', 'payment_terms')
    op.drop_column('rfqs', 'delivery_deadline')
    op.drop_column('rfqs', 'rfq_deadline')
    op.drop_column('rfqs', 'category')
    op.drop_column('rfqs', 'product')
