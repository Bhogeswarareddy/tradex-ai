"""015_ai_mode_conv_negotiation

Revision ID: 015_ai_mode_conv_negotiation
Revises: 014_index_jobs_attempts_error
Create Date: 2026-10-14 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '015_ai_mode_conv_negotiation'
down_revision: Union[str, None] = '014_index_jobs_attempts_error'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. ai_conversations
    op.create_table(
        'ai_conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), server_default='New Conversation', nullable=False),
        sa.Column('search_state', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_ai_conv_user_id', 'ai_conversations', ['user_id'])
    op.create_index('idx_ai_conv_deleted_at', 'ai_conversations', ['deleted_at'])
    op.create_index('idx_ai_conv_updated_at', 'ai_conversations', ['updated_at'])

    # 2. ai_messages
    op.create_table(
        'ai_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('structured', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('provider', sa.String(50), server_default='deterministic_fallback', nullable=False),
        sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_ai_messages_conv_id', 'ai_messages', ['conversation_id'])
    op.create_index('idx_ai_messages_created_at', 'ai_messages', ['created_at'])

    # 3. ai_selected_products
    op.create_table(
        'ai_selected_products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('conversation_id', 'product_id', name='uq_conv_product_selection'),
    )
    op.create_index('idx_ai_sel_prod_conv', 'ai_selected_products', ['conversation_id'])
    op.create_index('idx_ai_sel_prod_product', 'ai_selected_products', ['product_id'])

    # 4. negotiation_drafts
    op.create_table(
        'negotiation_drafts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('buyer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('original_unit_price', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(10), server_default='USD', nullable=False),
        sa.Column('original_moq', sa.Integer(), server_default='1', nullable=False),
        sa.Column('target_price', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('ai_suggested_message', sa.Text(), nullable=False),
        sa.Column('final_message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), server_default='draft', nullable=False),
        sa.Column('linked_thread_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('threads.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_neg_drafts_conv', 'negotiation_drafts', ['conversation_id'])
    op.create_index('idx_neg_drafts_product', 'negotiation_drafts', ['product_id'])
    op.create_index('idx_neg_drafts_supplier', 'negotiation_drafts', ['supplier_id'])
    op.create_index('idx_neg_drafts_buyer', 'negotiation_drafts', ['buyer_id'])


def downgrade() -> None:
    op.drop_table('negotiation_drafts')
    op.drop_table('ai_selected_products')
    op.drop_table('ai_messages')
    op.drop_table('ai_conversations')
