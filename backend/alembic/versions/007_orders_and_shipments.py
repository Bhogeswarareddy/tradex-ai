"""Add order procurement and shipment tracking columns (Prompt 16 & 17)

Revision ID: 007_orders_and_shipments
Revises: 006_landed_cost_and_threads
Create Date: 2026-10-10 20:07:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '007_orders_and_shipments'
down_revision: Union[str, None] = '006_landed_cost_and_threads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Orders table extensions
    op.add_column(
        'orders',
        sa.Column('payment_terms', sa.String(length=100), server_default='LC at sight, 30% advance', nullable=False)
    )
    op.add_column(
        'orders',
        sa.Column('shipping_address', sa.Text(), nullable=True)
    )
    op.add_column(
        'orders',
        sa.Column('documents', postgresql.JSONB(), server_default='[]', nullable=True)
    )

    # 2. Payments table extensions
    op.add_column(
        'payments',
        sa.Column('payment_type', sa.String(length=50), server_default='advance', nullable=False)
    )
    op.add_column(
        'payments',
        sa.Column('notes', sa.String(length=255), nullable=True)
    )

    # 3. Shipments table extensions
    op.add_column(
        'shipments',
        sa.Column('mode', sa.String(length=50), server_default='sea', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('vessel_or_flight', sa.String(length=100), server_default='MV Ocean Star', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('container_number', sa.String(length=50), server_default='TCNU1234567', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('freight_forwarder', sa.String(length=100), server_default='OceanLink Logistics', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('incoterm', sa.String(length=20), server_default='FOB', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('goods', sa.String(length=255), server_default='Organic Turmeric Powder, 20,000 MT', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('eta', sa.Date(), nullable=True)
    )
    op.add_column(
        'shipments',
        sa.Column('current_latitude', sa.Float(), server_default='15.5', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('current_longitude', sa.Float(), server_default='65.2', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('current_location', sa.String(length=150), server_default='Arabian Sea', nullable=False)
    )
    op.add_column(
        'shipments',
        sa.Column('documents', postgresql.JSONB(), server_default='[]', nullable=True)
    )


def downgrade() -> None:
    # Drop shipments columns
    op.drop_column('shipments', 'documents')
    op.drop_column('shipments', 'current_location')
    op.drop_column('shipments', 'current_longitude')
    op.drop_column('shipments', 'current_latitude')
    op.drop_column('shipments', 'eta')
    op.drop_column('shipments', 'goods')
    op.drop_column('shipments', 'incoterm')
    op.drop_column('shipments', 'freight_forwarder')
    op.drop_column('shipments', 'container_number')
    op.drop_column('shipments', 'vessel_or_flight')
    op.drop_column('shipments', 'mode')

    # Drop payments columns
    op.drop_column('payments', 'notes')
    op.drop_column('payments', 'payment_type')

    # Drop orders columns
    op.drop_column('orders', 'documents')
    op.drop_column('orders', 'shipping_address')
    op.drop_column('orders', 'payment_terms')
