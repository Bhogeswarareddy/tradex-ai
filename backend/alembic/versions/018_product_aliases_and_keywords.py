"""018_product_aliases_and_keywords

Revision ID: 018_product_aliases_and_keywords
Revises: 017_ai_msg_observability
Create Date: 2026-11-01 22:00:00.000000

Prompt 35: Product aliases table and search_keywords column on products
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = '018_product_aliases_and_keywords'
down_revision: Union[str, None] = '017_ai_msg_observability'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add search_keywords to products
    op.add_column('products', sa.Column('search_keywords', sa.Text(), nullable=True))

    # Create product_aliases table
    op.create_table(
        'product_aliases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alias', sa.String(255), nullable=False),
        sa.Column('alias_type', sa.String(50), nullable=False, server_default='synonym'),
        sa.Column('is_approved', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('idx_product_aliases_product_id', 'product_aliases', ['product_id'])
    op.create_index('idx_product_aliases_alias', 'product_aliases', ['alias'])


def downgrade() -> None:
    op.drop_index('idx_product_aliases_alias', table_name='product_aliases')
    op.drop_index('idx_product_aliases_product_id', table_name='product_aliases')
    op.drop_table('product_aliases')
    op.drop_column('products', 'search_keywords')
