"""010_market_series

Revision ID: 010_market_series
Revises: 009_copilot_rag
Create Date: 2026-10-11 06:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '010_market_series'
down_revision = '009_copilot_rag'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'market_series',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('destination', sa.String(length=100), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('demand_index', sa.Float(), nullable=False),
        sa.Column('avg_price', sa.Float(), nullable=False),
        sa.Column('volume', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_market_series_product', 'market_series', ['product'])
    op.create_index('idx_market_series_category', 'market_series', ['category'])
    op.create_index('idx_market_series_destination', 'market_series', ['destination'])
    op.create_index('idx_market_series_date', 'market_series', ['date'])
    op.create_index('idx_market_series_product_date', 'market_series', ['product', 'date'])
    op.create_index('idx_market_series_category_date', 'market_series', ['category', 'date'])
    op.create_index('idx_market_series_destination_date', 'market_series', ['destination', 'date'])


def downgrade() -> None:
    op.drop_table('market_series')
