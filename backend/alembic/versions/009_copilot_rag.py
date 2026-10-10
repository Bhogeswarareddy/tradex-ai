"""009_copilot_rag

Revision ID: 009_copilot_rag
Revises: 008_document_intelligence
Create Date: 2026-10-10 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_copilot_rag'
down_revision = '008_document_intelligence'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Update knowledge_chunks table
    op.alter_column('knowledge_chunks', 'embedding', nullable=True)
    op.add_column('knowledge_chunks', sa.Column('guide_slug', sa.String(length=100), nullable=True))
    op.add_column('knowledge_chunks', sa.Column('source_uri', sa.String(length=512), nullable=True))
    op.add_column('knowledge_chunks', sa.Column('is_public', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('knowledge_chunks', sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=True))

    op.create_foreign_key('fk_knowledge_chunks_company_id', 'knowledge_chunks', 'companies', ['company_id'], ['id'], ondelete='CASCADE')
    op.create_index('idx_knowledge_chunks_guide_slug', 'knowledge_chunks', ['guide_slug'])
    op.create_index('idx_knowledge_chunks_is_public', 'knowledge_chunks', ['is_public'])
    op.create_index('idx_knowledge_chunks_company_id', 'knowledge_chunks', ['company_id'])

    # 2. Create copilot_conversations table
    op.create_table(
        'copilot_conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), server_default='New Trade Inquiry', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_copilot_conversations_user_id', 'copilot_conversations', ['user_id'])

    # 3. Create copilot_messages table
    op.create_table(
        'copilot_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('suggested_actions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['copilot_conversations.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_copilot_messages_conversation_id', 'copilot_messages', ['conversation_id'])


def downgrade() -> None:
    op.drop_table('copilot_messages')
    op.drop_table('copilot_conversations')
    op.drop_constraint('fk_knowledge_chunks_company_id', 'knowledge_chunks', type_='foreignkey')
    op.drop_index('idx_knowledge_chunks_company_id', table_name='knowledge_chunks')
    op.drop_index('idx_knowledge_chunks_is_public', table_name='knowledge_chunks')
    op.drop_index('idx_knowledge_chunks_guide_slug', table_name='knowledge_chunks')
    op.drop_column('knowledge_chunks', 'company_id')
    op.drop_column('knowledge_chunks', 'is_public')
    op.drop_column('knowledge_chunks', 'source_uri')
    op.drop_column('knowledge_chunks', 'guide_slug')
