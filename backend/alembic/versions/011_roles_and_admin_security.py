"""011_roles_and_admin_security

Revision ID: 011_roles_and_admin_security
Revises: 010_market_series
Create Date: 2026-10-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision = '011_roles_and_admin_security'
down_revision = '010_market_series'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add account locking and MFA columns to users table
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('mfa_secret', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # 2. Canonical mapping for existing users to ADMIN, SUPPLIER, BUYER (upper/lower case normalized to lowercase canonical storage)
    # Map importer -> buyer, exporter -> supplier
    conn = op.get_bind()
    conn.execute(text("UPDATE users SET role = 'buyer' WHERE LOWER(role) IN ('buyer', 'importer')"))
    conn.execute(text("UPDATE users SET role = 'supplier' WHERE LOWER(role) IN ('supplier', 'exporter')"))
    conn.execute(text("UPDATE users SET role = 'admin' WHERE LOWER(role) = 'admin'"))

    # Ensure roles table contains canonical records
    conn.execute(text("""
        INSERT INTO roles (id, name, description, created_at, updated_at)
        VALUES 
            (gen_random_uuid(), 'buyer', 'B2B Buyer and Importer', NOW(), NOW()),
            (gen_random_uuid(), 'supplier', 'Verified Exporter and Manufacturer', NOW(), NOW()),
            (gen_random_uuid(), 'admin', 'Platform Administrator', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
    """))


def downgrade() -> None:
    op.drop_column('users', 'mfa_enabled')
    op.drop_column('users', 'mfa_secret')
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
