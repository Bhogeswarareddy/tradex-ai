"""Add simulated landed cost tables and negotiation threads

Revision ID: 006_landed_cost_and_threads
Revises: 005_rfq_workflow
Create Date: 2026-10-10 19:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '006_landed_cost_and_threads'
down_revision: Union[str, None] = '005_rfq_workflow'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create simulated landed cost tables
    op.create_table(
        'simulated_freight_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('origin_port', sa.String(length=100), nullable=False),
        sa.Column('origin_country', sa.String(length=100), nullable=False),
        sa.Column('destination_port', sa.String(length=100), nullable=False),
        sa.Column('destination_country', sa.String(length=100), nullable=False),
        sa.Column('container_type', sa.String(length=50), server_default='20FT', nullable=False),
        sa.Column('rate', sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column('currency', sa.String(length=10), server_default='EUR', nullable=False),
        sa.Column('transit_days', sa.Integer(), server_default='21', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_freight_route', 'simulated_freight_rates', ['origin_port', 'destination_port'])

    op.create_table(
        'simulated_tariff_duties',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('hs_code', sa.String(length=50), nullable=False),
        sa.Column('destination_country', sa.String(length=100), nullable=False),
        sa.Column('duty_rate', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('vat_tax_rate', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_tariff_hs_dest', 'simulated_tariff_duties', ['hs_code', 'destination_country'])

    op.create_table(
        'simulated_port_handling_fees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('port_name', sa.String(length=100), nullable=False),
        sa.Column('country', sa.String(length=100), nullable=False),
        sa.Column('terminal_handling_per_kg', sa.Numeric(precision=12, scale=4), server_default='0.0350', nullable=False),
        sa.Column('customs_clearance_flat', sa.Numeric(precision=12, scale=4), server_default='150.0000', nullable=False),
        sa.Column('currency', sa.String(length=10), server_default='EUR', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_port_handling_name', 'simulated_port_handling_fees', ['port_name'])

    op.create_table(
        'simulated_exchange_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('from_currency', sa.String(length=10), nullable=False),
        sa.Column('to_currency', sa.String(length=10), nullable=False),
        sa.Column('rate', sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_fx_pair', 'simulated_exchange_rates', ['from_currency', 'to_currency'])

    # 2. Create threads table
    op.create_table(
        'threads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('rfq_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rfqs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quotation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('quotations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='SET NULL'), nullable=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
        sa.Column('buyer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('buyers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_threads_buyer_id', 'threads', ['buyer_id'])
    op.create_index('idx_threads_supplier_id', 'threads', ['supplier_id'])
    op.create_index('idx_threads_rfq_id', 'threads', ['rfq_id'])

    # 3. Add columns to messages table
    op.add_column('messages', sa.Column('message_type', sa.String(length=50), server_default='text', nullable=False))
    op.add_column('messages', sa.Column('offer_data', postgresql.JSONB(), nullable=True))

    # 4. Add event_type to notifications table
    op.add_column('notifications', sa.Column('event_type', sa.String(length=50), server_default='general', nullable=False))


def downgrade() -> None:
    op.drop_column('notifications', 'event_type')
    op.drop_column('messages', 'offer_data')
    op.drop_column('messages', 'message_type')

    op.drop_table('threads')
    op.drop_table('simulated_exchange_rates')
    op.drop_table('simulated_port_handling_fees')
    op.drop_table('simulated_tariff_duties')
    op.drop_table('simulated_freight_rates')
