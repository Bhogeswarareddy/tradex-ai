"""016_supplier_categories_and_exchange_rates

Revision ID: 016_supplier_categories_and_exchange_rates
Revises: 015_ai_mode_conv_negotiation
Create Date: 2026-10-29 09:00:00.000000

"""
import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '016_supp_cat_exchange_rates'
down_revision: Union[str, None] = '015_ai_mode_conv_negotiation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. supplier_categories table
    op.create_table(
        'supplier_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_supplier_category_pair', 'supplier_categories', ['supplier_id', 'category_id'], unique=True)
    op.create_index('idx_supplier_categories_supplier_id', 'supplier_categories', ['supplier_id'])
    op.create_index('idx_supplier_categories_category_id', 'supplier_categories', ['category_id'])

    # 2. exchange_rates table
    op.create_table(
        'exchange_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('base_currency', sa.String(10), nullable=False),
        sa.Column('quote_currency', sa.String(10), nullable=False),
        sa.Column('rate', sa.Numeric(14, 6), nullable=False),
        sa.Column('as_of', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('source', sa.String(50), server_default='ECB_SIMULATED', nullable=False),
        sa.Column('is_simulated', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_exchange_rates_pair', 'exchange_rates', ['base_currency', 'quote_currency'], unique=True)
    op.create_index('idx_exchange_rates_base', 'exchange_rates', ['base_currency'])
    op.create_index('idx_exchange_rates_quote', 'exchange_rates', ['quote_currency'])

    # 3. Add is_demo column to products
    op.add_column('products', sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False))

    conn = op.get_bind()

    # 4. Seed standard exchange rates
    rates_data = [
        # Base USD
        ("USD", "USD", 1.0),
        ("USD", "EUR", 0.920000),
        ("USD", "INR", 83.500000),
        ("USD", "GBP", 0.790000),
        ("USD", "AED", 3.672500),
        ("USD", "CNY", 7.235000),
        # Base EUR
        ("EUR", "EUR", 1.0),
        ("EUR", "USD", 1.086957),
        ("EUR", "INR", 90.760870),
        ("EUR", "GBP", 0.858696),
        ("EUR", "AED", 3.991848),
        ("EUR", "CNY", 7.864130),
        # Base INR
        ("INR", "INR", 1.0),
        ("INR", "USD", 0.011976),
        ("INR", "EUR", 0.011018),
        ("INR", "GBP", 0.009461),
        ("INR", "AED", 0.043982),
        ("INR", "CNY", 0.086647),
        # Base GBP
        ("GBP", "GBP", 1.0),
        ("GBP", "USD", 1.265823),
        ("GBP", "EUR", 1.164557),
        ("GBP", "INR", 105.696203),
        ("GBP", "AED", 4.648734),
        ("GBP", "CNY", 9.158228),
        # Base AED
        ("AED", "AED", 1.0),
        ("AED", "USD", 0.272294),
        ("AED", "EUR", 0.250511),
        ("AED", "INR", 22.736555),
        ("AED", "GBP", 0.215112),
        ("AED", "CNY", 1.970048),
        # Base CNY
        ("CNY", "CNY", 1.0),
        ("CNY", "USD", 0.138217),
        ("CNY", "EUR", 0.127160),
        ("CNY", "INR", 11.541119),
        ("CNY", "GBP", 0.109191),
        ("CNY", "AED", 0.507602),
    ]

    for base, quote, rate in rates_data:
        conn.execute(
            sa.text(
                "INSERT INTO exchange_rates (id, base_currency, quote_currency, rate, as_of, source, is_simulated, created_at, updated_at) "
                "VALUES (:id, :base, :quote, :rate, now(), 'ECB_SIMULATED', true, now(), now()) "
                "ON CONFLICT (base_currency, quote_currency) DO UPDATE SET rate = EXCLUDED.rate, updated_at = now()"
            ),
            {"id": str(uuid.uuid4()), "base": base, "quote": quote, "rate": rate}
        )

    # 5. Populate supplier_categories for existing suppliers and products
    # First: find category electronics and company Shenzhen Horizon Electronics Ltd
    elec_cat = conn.execute(sa.text("SELECT id FROM categories WHERE slug = 'electronics' LIMIT 1")).scalar()
    shenzhen_sup = conn.execute(
        sa.text("SELECT s.id FROM suppliers s JOIN companies c ON s.company_id = c.id WHERE c.name ILIKE '%Shenzhen Horizon Electronics%' LIMIT 1")
    ).scalar()

    # Re-link misplaced laptops to Shenzhen Horizon Electronics Ltd and category electronics
    if elec_cat and shenzhen_sup:
        conn.execute(
            sa.text(
                "UPDATE products SET "
                "  supplier_id = :sup_id, "
                "  category_id = :cat_id, "
                "  certifications_json = '[{\"name\": \"CE Mark\", \"code\": \"CE\"}, {\"name\": \"FCC\", \"code\": \"FCC\"}, {\"name\": \"RoHS\", \"code\": \"ROHS\"}]'::jsonb, "
                "  is_demo = true "
                "WHERE (name ILIKE '%laptop%' OR name ILIKE '%notebook%' OR name ILIKE '%probook%' OR name ILIKE '%ultrabook%')"
            ),
            {"sup_id": shenzhen_sup, "cat_id": elec_cat}
        )

    # 6. Populate supplier_categories for every supplier based on products they sell
    conn.execute(
        sa.text(
            "INSERT INTO supplier_categories (id, supplier_id, category_id, created_at, updated_at) "
            "SELECT gen_random_uuid(), p.supplier_id, p.category_id, now(), now() "
            "FROM products p "
            "WHERE p.deleted_at IS NULL "
            "GROUP BY p.supplier_id, p.category_id "
            "ON CONFLICT (supplier_id, category_id) DO NOTHING"
        )
    )

    # Ensure Shenzhen Horizon has electronics
    if elec_cat and shenzhen_sup:
        conn.execute(
            sa.text(
                "INSERT INTO supplier_categories (id, supplier_id, category_id, created_at, updated_at) "
                "VALUES (gen_random_uuid(), :sup_id, :cat_id, now(), now()) "
                "ON CONFLICT (supplier_id, category_id) DO NOTHING"
            ),
            {"sup_id": shenzhen_sup, "cat_id": elec_cat}
        )

    # Mark demo products
    conn.execute(
        sa.text(
            "UPDATE products SET is_demo = true WHERE name ILIKE '%TradeX%' OR name ILIKE '%Demo%' OR name ILIKE '%ProBook%' OR name ILIKE '%UltraBook%'"
        )
    )


def downgrade() -> None:
    op.drop_column('products', 'is_demo')
    op.drop_table('exchange_rates')
    op.drop_table('supplier_categories')
