"""Add supplier storefront, capacity, and product specification fields

Revision ID: 003_suppliers_and_storefront
Revises: 002_auth_refresh_tokens
Create Date: 2026-10-10 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_suppliers_and_storefront'
down_revision: Union[str, None] = '002_auth_refresh_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Company additions
    op.add_column('companies', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('companies', sa.Column('banner_url', sa.String(512), nullable=True))
    op.add_column('companies', sa.Column('languages', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('companies', sa.Column('factory_details', postgresql.JSONB(), nullable=True))

    # Supplier additions
    op.add_column('suppliers', sa.Column('repeat_buyer_rate', sa.Float(), server_default='84.0', nullable=False))
    op.add_column('suppliers', sa.Column('total_buyers_count', sa.Integer(), server_default='320', nullable=False))

    # Product additions
    op.add_column('products', sa.Column('specifications', postgresql.JSONB(), nullable=True))
    op.add_column('products', sa.Column('stock_available', sa.Integer(), server_default='1000', nullable=False))
    op.add_column('products', sa.Column('next_available_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'next_available_date')
    op.drop_column('products', 'stock_available')
    op.drop_column('products', 'specifications')

    op.drop_column('suppliers', 'total_buyers_count')
    op.drop_column('suppliers', 'repeat_buyer_rate')

    op.drop_column('companies', 'factory_details')
    op.drop_column('companies', 'languages')
    op.drop_column('companies', 'banner_url')
    op.drop_column('companies', 'state')
