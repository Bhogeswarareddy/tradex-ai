"""008_document_intelligence

Revision ID: 008_document_intelligence
Revises: 007_orders_and_shipments
Create Date: 2026-10-10 23:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008_document_intelligence'
down_revision = '007_orders_and_shipments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to documents
    op.add_column('documents', sa.Column('original_filename', sa.String(length=255), server_default='document.pdf', nullable=False))
    op.add_column('documents', sa.Column('status', sa.String(length=50), server_default='uploaded', nullable=False))
    op.add_column('documents', sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('documents', sa.Column('rfq_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('documents', sa.Column('supplier_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('documents', sa.Column('expiry_date', sa.Date(), nullable=True))

    op.create_foreign_key('fk_documents_order_id', 'documents', 'orders', ['order_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_documents_rfq_id', 'documents', 'rfqs', ['rfq_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_documents_supplier_id', 'documents', 'suppliers', ['supplier_id'], ['id'], ondelete='SET NULL')

    op.create_index('idx_documents_status', 'documents', ['status'])
    op.create_index('idx_documents_order_id', 'documents', ['order_id'])
    op.create_index('idx_documents_supplier_id', 'documents', ['supplier_id'])

    # Add review columns to document_extractions
    op.add_column('document_extractions', sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('document_extractions', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_document_extractions_reviewed_by', 'document_extractions', 'users', ['reviewed_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_document_extractions_reviewed_by', 'document_extractions', type_='foreignkey')
    op.drop_column('document_extractions', 'reviewed_at')
    op.drop_column('document_extractions', 'reviewed_by')

    op.drop_index('idx_documents_supplier_id', table_name='documents')
    op.drop_index('idx_documents_order_id', table_name='documents')
    op.drop_index('idx_documents_status', table_name='documents')

    op.drop_constraint('fk_documents_supplier_id', 'documents', type_='foreignkey')
    op.drop_constraint('fk_documents_rfq_id', 'documents', type_='foreignkey')
    op.drop_constraint('fk_documents_order_id', 'documents', type_='foreignkey')

    op.drop_column('documents', 'expiry_date')
    op.drop_column('documents', 'supplier_id')
    op.drop_column('documents', 'rfq_id')
    op.drop_column('documents', 'order_id')
    op.drop_column('documents', 'status')
    op.drop_column('documents', 'original_filename')