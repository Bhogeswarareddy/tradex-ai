"""013_knowledge_indexing_and_rag

Revision ID: 013_knowledge_indexing_and_rag
Revises: 012_supplier_product_catalogue
Create Date: 2026-10-14 20:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '013_knowledge_indexing_and_rag'
down_revision: Union[str, None] = '012_supplier_product_catalogue'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create knowledge_documents table
    op.create_table(
        'knowledge_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source_type', sa.String(length=50), nullable=False),  # product, company, certificate_document, trade_guide, faq
        sa.Column('source_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=True),
        sa.Column('visibility', sa.String(length=50), server_default='public', nullable=False),  # public, supplier_private, admin_only
        sa.Column('status', sa.String(length=50), server_default='active', nullable=False),  # active, inactive, stale
        sa.Column('content_hash', sa.String(length=64), nullable=True),
        sa.Column('embedding_model', sa.String(length=100), server_default='mock-embed-v1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )

    op.create_index('idx_knowledge_docs_source', 'knowledge_documents', ['source_type', 'source_id'])
    op.create_index('idx_knowledge_docs_product', 'knowledge_documents', ['product_id'])
    op.create_index('idx_knowledge_docs_supplier', 'knowledge_documents', ['supplier_id'])
    op.create_index('idx_knowledge_docs_visibility', 'knowledge_documents', ['visibility'])
    op.create_index('idx_knowledge_docs_content_hash', 'knowledge_documents', ['content_hash'])

    # 2. Add columns to knowledge_chunks table
    op.add_column('knowledge_chunks', sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('knowledge_documents.id', ondelete='CASCADE'), nullable=True))
    op.add_column('knowledge_chunks', sa.Column('text', sa.Text(), nullable=True))
    op.add_column('knowledge_chunks', sa.Column('embedding_model', sa.String(length=100), server_default='mock-embed-v1', nullable=True))
    op.add_column('knowledge_chunks', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))

    op.create_index('idx_knowledge_chunks_document_id', 'knowledge_chunks', ['document_id'])
    op.create_index('idx_knowledge_chunks_is_active', 'knowledge_chunks', ['is_active'])

    # 3. GIN Full-Text Index on knowledge_chunks
    op.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv ON knowledge_chunks USING gin(to_tsvector('english', coalesce(content, text, '')));")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunks_tsv;")
    op.drop_index('idx_knowledge_chunks_is_active', table_name='knowledge_chunks')
    op.drop_index('idx_knowledge_chunks_document_id', table_name='knowledge_chunks')
    op.drop_column('knowledge_chunks', 'is_active')
    op.drop_column('knowledge_chunks', 'embedding_model')
    op.drop_column('knowledge_chunks', 'text')
    op.drop_column('knowledge_chunks', 'document_id')

    op.drop_index('idx_knowledge_docs_content_hash', table_name='knowledge_documents')
    op.drop_index('idx_knowledge_docs_visibility', table_name='knowledge_documents')
    op.drop_index('idx_knowledge_docs_supplier', table_name='knowledge_documents')
    op.drop_index('idx_knowledge_docs_product', table_name='knowledge_documents')
    op.drop_index('idx_knowledge_docs_source', table_name='knowledge_documents')
    op.drop_table('knowledge_documents')
