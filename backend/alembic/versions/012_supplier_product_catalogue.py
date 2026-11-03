"""012_supplier_product_catalogue

Revision ID: 012_supplier_product_catalogue
Revises: 011_roles_and_admin_security
Create Date: 2026-10-14 20:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = '012_supplier_product_catalogue'
down_revision: Union[str, None] = '011_roles_and_admin_security'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add missing catalogue, status flow, freshness and logistics columns to products table
    op.add_column('products', sa.Column('product_form', sa.String(100), nullable=True))
    op.add_column('products', sa.Column('production_region', sa.String(150), nullable=True))
    op.add_column('products', sa.Column('currency', sa.String(10), server_default='USD', nullable=False))
    op.add_column('products', sa.Column('price_valid_from', sa.Date(), nullable=True))
    op.add_column('products', sa.Column('price_valid_until', sa.Date(), nullable=True))
    op.add_column('products', sa.Column('available_quantity', sa.Integer(), server_default='0', nullable=False))
    op.add_column('products', sa.Column('reserved_quantity', sa.Integer(), server_default='0', nullable=False))
    op.add_column('products', sa.Column('availability_status', sa.String(50), server_default='in_stock', nullable=False))
    op.add_column('products', sa.Column('monthly_capacity', sa.String(100), nullable=True))
    op.add_column('products', sa.Column('packaging', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('storage', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('export_details', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('supported_destinations', postgresql.JSONB(), nullable=True))
    op.add_column('products', sa.Column('incoterms', postgresql.JSONB(), nullable=True))
    op.add_column('products', sa.Column('payment_terms', postgresql.JSONB(), nullable=True))
    op.add_column('products', sa.Column('supporting_documents', postgresql.JSONB(), nullable=True))
    op.add_column('products', sa.Column('certifications_json', postgresql.JSONB(), nullable=True))
    op.add_column('products', sa.Column('status', sa.String(50), server_default='published', nullable=False))
    op.add_column('products', sa.Column('rejection_reason', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('admin_notes', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('price_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('products', sa.Column('inventory_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('products', sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))

    op.create_index('idx_products_status', 'products', ['status'])

    # 2. Initialize existing product records so they remain published and confirmed
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE products 
        SET available_quantity = stock_available,
            status = 'published',
            price_confirmed_at = NOW(),
            inventory_confirmed_at = NOW(),
            confirmed_at = NOW()
        WHERE status IS NULL OR status = 'published'
    """))

    # 3. Create index_jobs table for search / RAG queue hook (Prompt 15 / 16)
    op.create_table(
        'index_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.String(100), nullable=False),
        sa.Column('operation', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), server_default='pending', nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_index_jobs_entity', 'index_jobs', ['entity_type', 'entity_id'])
    op.create_index('idx_index_jobs_status', 'index_jobs', ['status'])


def downgrade() -> None:
    op.drop_index('idx_index_jobs_status', table_name='index_jobs')
    op.drop_index('idx_index_jobs_entity', table_name='index_jobs')
    op.drop_table('index_jobs')

    op.drop_index('idx_products_status', table_name='products')
    op.drop_column('products', 'confirmed_at')
    op.drop_column('products', 'inventory_confirmed_at')
    op.drop_column('products', 'price_confirmed_at')
    op.drop_column('products', 'admin_notes')
    op.drop_column('products', 'rejection_reason')
    op.drop_column('products', 'status')
    op.drop_column('products', 'certifications_json')
    op.drop_column('products', 'supporting_documents')
    op.drop_column('products', 'payment_terms')
    op.drop_column('products', 'incoterms')
    op.drop_column('products', 'supported_destinations')
    op.drop_column('products', 'export_details')
    op.drop_column('products', 'storage')
    op.drop_column('products', 'packaging')
    op.drop_column('products', 'monthly_capacity')
    op.drop_column('products', 'availability_status')
    op.drop_column('products', 'reserved_quantity')
    op.drop_column('products', 'available_quantity')
    op.drop_column('products', 'price_valid_until')
    op.drop_column('products', 'price_valid_from')
    op.drop_column('products', 'currency')
    op.drop_column('products', 'production_region')
    op.drop_column('products', 'product_form')
