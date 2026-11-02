"""019_scale_features

Revision ID: 019_scale_features
Revises: 018_product_aliases_and_keywords
Create Date: 2026-11-02 00:00:00.000000

Prompt 42: Scale demo flags, supplier verification tiers, KYC, reviews moderation, quote sharing, and performance indexes.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = '019_scale_features'
down_revision: Union[str, None] = '018_product_aliases_and_keywords'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 0. Add user settings jsonb column
    conn.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;"))

    # 1. Add is_demo boolean to core trade entities
    for tbl in ['companies', 'suppliers', 'buyers', 'rfqs', 'orders', 'shipments', 'reviews']:
        conn.execute(sa.text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;"))
        conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_is_demo ON {tbl} (is_demo);"))

    # 2. Add Supplier Verification Tiers and KYC columns
    conn.execute(sa.text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verification_tier VARCHAR(50) NOT NULL DEFAULT 'Bronze';"))
    conn.execute(sa.text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tier_reason TEXT;"))
    conn.execute(sa.text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) NOT NULL DEFAULT 'verified';"))
    conn.execute(sa.text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS kyc_documents JSONB;"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_suppliers_verification_tier ON suppliers (verification_tier);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_suppliers_kyc_status ON suppliers (kyc_status);"))

    # 3. Add order reference and moderation to reviews
    conn.execute(sa.text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;"))
    conn.execute(sa.text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'approved';"))
    conn.execute(sa.text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_note TEXT;"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews (order_id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status);"))

    # 4. Add share token and expiry to RFQs for quote comparison sharing
    conn.execute(sa.text("ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS share_token VARCHAR(100);"))
    conn.execute(sa.text("ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_rfqs_share_token ON rfqs (share_token);"))

    # 5. Performance composite indexes
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_products_cat_active_demo ON products (category_id, is_active, is_demo);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_products_origin_active ON products (origin_country, is_active);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders (buyer_id, status);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_orders_supplier_status ON orders (supplier_id, status);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_shipments_order_status ON shipments (order_id, status);"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_shipments_order_status;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_orders_supplier_status;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_orders_buyer_status;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_products_origin_active;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_products_cat_active_demo;"))

    conn.execute(sa.text("DROP INDEX IF EXISTS idx_rfqs_share_token;"))
    conn.execute(sa.text("ALTER TABLE rfqs DROP COLUMN IF EXISTS share_expires_at;"))
    conn.execute(sa.text("ALTER TABLE rfqs DROP COLUMN IF EXISTS share_token;"))

    conn.execute(sa.text("DROP INDEX IF EXISTS idx_reviews_status;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_reviews_order_id;"))
    conn.execute(sa.text("ALTER TABLE reviews DROP COLUMN IF EXISTS moderation_note;"))
    conn.execute(sa.text("ALTER TABLE reviews DROP COLUMN IF EXISTS status;"))
    conn.execute(sa.text("ALTER TABLE reviews DROP COLUMN IF EXISTS order_id;"))

    conn.execute(sa.text("DROP INDEX IF EXISTS idx_suppliers_kyc_status;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_suppliers_verification_tier;"))
    conn.execute(sa.text("ALTER TABLE suppliers DROP COLUMN IF EXISTS kyc_documents;"))
    conn.execute(sa.text("ALTER TABLE suppliers DROP COLUMN IF EXISTS kyc_status;"))
    conn.execute(sa.text("ALTER TABLE suppliers DROP COLUMN IF EXISTS tier_reason;"))
    conn.execute(sa.text("ALTER TABLE suppliers DROP COLUMN IF EXISTS verification_tier;"))

    for tbl in ['companies', 'suppliers', 'buyers', 'rfqs', 'orders', 'shipments', 'reviews']:
        conn.execute(sa.text(f"DROP INDEX IF EXISTS idx_{tbl}_is_demo;"))
        conn.execute(sa.text(f"ALTER TABLE {tbl} DROP COLUMN IF EXISTS is_demo;"))
