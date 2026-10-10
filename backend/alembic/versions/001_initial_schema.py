"""Initial complete schema with pgvector

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-10 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Roles
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_roles_name', 'roles', ['name'])

    # 3. Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), server_default='buyer', nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('email_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_role', 'users', ['role'])

    # 4. Companies
    op.create_table(
        'companies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('country', sa.String(100), nullable=False),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('website', sa.String(255), nullable=True),
        sa.Column('logo_url', sa.String(512), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('years_in_business', sa.Integer(), server_default='0', nullable=False),
        sa.Column('verified_status', sa.String(50), server_default='unverified', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('years_in_business >= 0', name='chk_company_years_non_negative'),
    )
    op.create_index('idx_companies_name', 'companies', ['name'])
    op.create_index('idx_companies_country', 'companies', ['country'])
    op.create_index('idx_companies_verified_status', 'companies', ['verified_status'])

    # 5. Buyers
    op.create_table(
        'buyers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('import_destinations', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_buyers_company_id', 'buyers', ['company_id'])
    op.create_index('idx_buyers_user_id', 'buyers', ['user_id'])

    # 6. Suppliers
    op.create_table(
        'suppliers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('trust_score', sa.Float(), server_default='5.0', nullable=False),
        sa.Column('on_time_rate', sa.Float(), server_default='100.0', nullable=False),
        sa.Column('capacity_per_month', sa.String(100), server_default='100 MT', nullable=False),
        sa.Column('export_countries', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('response_time_hours', sa.Float(), server_default='24.0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('trust_score >= 0.0 AND trust_score <= 5.0', name='chk_supplier_trust_score'),
        sa.CheckConstraint('on_time_rate >= 0.0 AND on_time_rate <= 100.0', name='chk_supplier_on_time_rate'),
        sa.CheckConstraint('response_time_hours >= 0.0', name='chk_supplier_response_time'),
    )
    op.create_index('idx_suppliers_company_id', 'suppliers', ['company_id'])
    op.create_index('idx_suppliers_user_id', 'suppliers', ['user_id'])
    op.create_index('idx_suppliers_trust_score', 'suppliers', ['trust_score'])

    # 7. Categories
    op.create_table(
        'categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_categories_slug', 'categories', ['slug'])
    op.create_index('idx_categories_parent_id', 'categories', ['parent_id'])

    # 8. Certifications
    op.create_table(
        'certifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50), unique=True, nullable=False),
        sa.Column('issuing_body', sa.String(150), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_certifications_code', 'certifications', ['code'])

    # 9. Supplier Certifications
    op.create_table(
        'supplier_certifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('certification_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('certifications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('certificate_no', sa.String(100), nullable=False),
        sa.Column('issued_at', sa.Date(), nullable=True),
        sa.Column('expires_at', sa.Date(), nullable=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_supplier_certs_supplier_id', 'supplier_certifications', ['supplier_id'])
    op.create_index('idx_supplier_certs_cert_id', 'supplier_certifications', ['certification_id'])

    # 10. Products
    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), unique=True, nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('hs_code', sa.String(50), nullable=True),
        sa.Column('moq', sa.Integer(), server_default='1', nullable=False),
        sa.Column('unit', sa.String(50), server_default='kg', nullable=False),
        sa.Column('origin_country', sa.String(100), nullable=False),
        sa.Column('lead_time_days', sa.Integer(), server_default='14', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('moq > 0', name='chk_product_moq_positive'),
        sa.CheckConstraint('lead_time_days >= 0', name='chk_product_lead_time_non_negative'),
    )
    op.create_index('idx_products_slug', 'products', ['slug'])
    op.create_index('idx_products_supplier_id', 'products', ['supplier_id'])
    op.create_index('idx_products_category_id', 'products', ['category_id'])
    op.create_index('idx_products_origin_country', 'products', ['origin_country'])
    op.create_index('idx_products_is_active', 'products', ['is_active'])

    # 11. Product Images
    op.create_table(
        'product_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('image_url', sa.String(512), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_product_images_product_id', 'product_images', ['product_id'])

    # 12. Price Tiers
    op.create_table(
        'price_tiers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('min_qty', sa.Integer(), nullable=False),
        sa.Column('max_qty', sa.Integer(), nullable=True),
        sa.Column('unit_price', sa.Numeric(12, 4), nullable=False),
        sa.Column('currency', sa.String(10), server_default='USD', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('min_qty > 0', name='chk_price_tier_min_qty_positive'),
        sa.CheckConstraint('unit_price >= 0', name='chk_price_tier_price_non_negative'),
    )
    op.create_index('idx_price_tiers_product_id', 'price_tiers', ['product_id'])

    # 13. RFQs
    op.create_table(
        'rfqs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('rfq_number', sa.String(50), unique=True, nullable=False),
        sa.Column('buyer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('buyers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), server_default='open', nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit', sa.String(50), server_default='kg', nullable=False),
        sa.Column('target_price_min', sa.Numeric(12, 4), server_default='0', nullable=False),
        sa.Column('target_price_max', sa.Numeric(12, 4), server_default='0', nullable=False),
        sa.Column('currency', sa.String(10), server_default='EUR', nullable=False),
        sa.Column('destination_country', sa.String(100), nullable=False),
        sa.Column('destination_port', sa.String(100), nullable=False),
        sa.Column('deadline', sa.Date(), nullable=False),
        sa.Column('incoterm', sa.String(20), server_default='CIF', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('quantity > 0', name='chk_rfq_quantity_positive'),
        sa.CheckConstraint('target_price_min >= 0', name='chk_rfq_price_min_non_negative'),
        sa.CheckConstraint('target_price_max >= target_price_min', name='chk_rfq_price_range_valid'),
    )
    op.create_index('idx_rfqs_number', 'rfqs', ['rfq_number'])
    op.create_index('idx_rfqs_buyer_id', 'rfqs', ['buyer_id'])
    op.create_index('idx_rfqs_status', 'rfqs', ['status'])
    op.create_index('idx_rfqs_destination_country', 'rfqs', ['destination_country'])

    # 14. RFQ Items
    op.create_table(
        'rfq_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('rfq_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
        sa.Column('item_name', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit', sa.String(50), server_default='kg', nullable=False),
        sa.Column('target_price', sa.Numeric(12, 4), server_default='0', nullable=False),
        sa.Column('specifications', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_rfq_item_quantity_positive'),
        sa.CheckConstraint('target_price >= 0', name='chk_rfq_item_price_non_negative'),
    )
    op.create_index('idx_rfq_items_rfq_id', 'rfq_items', ['rfq_id'])

    # 15. Quotations
    op.create_table(
        'quotations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('quote_number', sa.String(50), unique=True, nullable=False),
        sa.Column('rfq_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 4), nullable=False),
        sa.Column('landed_cost', sa.Numeric(12, 4), nullable=False),
        sa.Column('freight_cost', sa.Numeric(12, 4), server_default='0', nullable=False),
        sa.Column('lead_time_days', sa.Integer(), nullable=False),
        sa.Column('payment_terms', sa.String(100), server_default='LC at sight', nullable=False),
        sa.Column('valid_until', sa.Date(), nullable=False),
        sa.Column('status', sa.String(50), server_default='submitted', nullable=False),
        sa.Column('ai_score', sa.Float(), server_default='85.0', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('rfq_id', 'supplier_id', name='uq_quote_rfq_supplier'),
        sa.CheckConstraint('unit_price >= 0', name='chk_quote_unit_price_non_negative'),
        sa.CheckConstraint('landed_cost >= 0', name='chk_quote_landed_cost_non_negative'),
        sa.CheckConstraint('lead_time_days >= 0', name='chk_quote_lead_time_non_negative'),
        sa.CheckConstraint('ai_score >= 0.0 AND ai_score <= 100.0', name='chk_quote_ai_score_range'),
    )
    op.create_index('idx_quotations_quote_number', 'quotations', ['quote_number'])
    op.create_index('idx_quotations_rfq_id', 'quotations', ['rfq_id'])
    op.create_index('idx_quotations_supplier_id', 'quotations', ['supplier_id'])
    op.create_index('idx_quotations_status', 'quotations', ['status'])

    # 16. Orders
    op.create_table(
        'orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_number', sa.String(50), unique=True, nullable=False),
        sa.Column('rfq_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rfqs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quotation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('quotations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('buyer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('buyers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('total_amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('currency', sa.String(10), server_default='EUR', nullable=False),
        sa.Column('status', sa.String(50), server_default='confirmed', nullable=False),
        sa.Column('incoterm', sa.String(20), server_default='CIF', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('total_amount >= 0', name='chk_order_total_amount_non_negative'),
    )
    op.create_index('idx_orders_number', 'orders', ['order_number'])
    op.create_index('idx_orders_status', 'orders', ['status'])

    # 17. Order Items
    op.create_table(
        'order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit', sa.String(50), server_default='kg', nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 4), nullable=False),
        sa.Column('total_price', sa.Numeric(14, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_order_item_qty_positive'),
        sa.CheckConstraint('unit_price >= 0', name='chk_order_item_price_non_negative'),
        sa.CheckConstraint('total_price >= 0', name='chk_order_item_total_non_negative'),
    )
    op.create_index('idx_order_items_order_id', 'order_items', ['order_id'])

    # 18. Payments (simulated flag)
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('currency', sa.String(10), server_default='EUR', nullable=False),
        sa.Column('status', sa.String(50), server_default='pending', nullable=False),
        sa.Column('payment_method', sa.String(50), server_default='Escrow', nullable=False),
        sa.Column('simulated', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('transaction_ref', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('amount >= 0', name='chk_payment_amount_non_negative'),
    )
    op.create_index('idx_payments_order_id', 'payments', ['order_id'])
    op.create_index('idx_payments_status', 'payments', ['status'])

    # 19. Shipments
    op.create_table(
        'shipments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('shipment_number', sa.String(50), unique=True, nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('carrier', sa.String(100), nullable=False),
        sa.Column('tracking_number', sa.String(100), nullable=False),
        sa.Column('origin', sa.String(150), nullable=False),
        sa.Column('destination', sa.String(150), nullable=False),
        sa.Column('estimated_delivery', sa.Date(), nullable=False),
        sa.Column('actual_delivery', sa.Date(), nullable=True),
        sa.Column('status', sa.String(50), server_default='in_transit', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_shipments_number', 'shipments', ['shipment_number'])
    op.create_index('idx_shipments_order_id', 'shipments', ['order_id'])
    op.create_index('idx_shipments_tracking', 'shipments', ['tracking_number'])
    op.create_index('idx_shipments_status', 'shipments', ['status'])

    # 20. Shipment Events
    op.create_table(
        'shipment_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('shipment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('shipments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('location', sa.String(150), nullable=False),
        sa.Column('description', sa.String(255), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_shipment_events_shipment_id', 'shipment_events', ['shipment_id'])

    # 21. Documents
    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(512), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('doc_type', sa.String(50), server_default='specification', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_documents_user_id', 'documents', ['user_id'])
    op.create_index('idx_documents_doc_type', 'documents', ['doc_type'])

    # 22. Document Extractions
    op.create_table(
        'document_extractions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('extracted_json', postgresql.JSONB(), nullable=False),
        sa.Column('confidence_score', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('status', sa.String(50), server_default='completed', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_doc_extractions_document_id', 'document_extractions', ['document_id'])

    # 23. Messages
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('thread_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('attachments', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_messages_thread_id', 'messages', ['thread_id'])
    op.create_index('idx_messages_sender_id', 'messages', ['sender_id'])

    # 24. Notifications
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('link', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_notifications_user_id', 'notifications', ['user_id'])

    # 25. Reviews
    op.create_table(
        'reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('buyer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('buyers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='chk_review_rating_1_to_5'),
    )
    op.create_index('idx_reviews_supplier_id', 'reviews', ['supplier_id'])

    # 26. Saved Items
    op.create_table(
        'saved_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_type', sa.String(50), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_saved_items_user_item', 'saved_items', ['user_id', 'item_type', 'item_id'])

    # 27. AI Searches
    op.create_table(
        'ai_searches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('filters', postgresql.JSONB(), nullable=True),
        sa.Column('results_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('execution_time_ms', sa.Float(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_ai_searches_user_id', 'ai_searches', ['user_id'])

    # 28. AI Recommendations
    op.create_table(
        'ai_recommendations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('reasoning', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_ai_recs_user_entity', 'ai_recommendations', ['user_id', 'entity_type', 'entity_id'])

    # 29. Knowledge Chunks with Vector(1536)
    op.create_table(
        'knowledge_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(1536), nullable=False),
        sa.Column('metadata', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_knowledge_chunks_entity', 'knowledge_chunks', ['entity_type', 'entity_id'])

    # 30. Market Insights
    op.create_table(
        'market_insights',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('commodity', sa.String(100), nullable=False),
        sa.Column('region', sa.String(100), nullable=False),
        sa.Column('price_trend', sa.String(50), server_default='stable', nullable=False),
        sa.Column('commentary', sa.Text(), nullable=False),
        sa.Column('source', sa.String(150), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_market_insights_commodity', 'market_insights', ['commodity'])

    # 31. Audit Logs
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('idx_audit_logs_entity', 'audit_logs', ['entity_type', 'entity_id'])

    # 32. System Settings
    op.create_table(
        'system_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('key', sa.String(100), unique=True, nullable=False),
        sa.Column('value', postgresql.JSONB(), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_system_settings_key', 'system_settings', ['key'])

    # 33. GIN Full-Text Search Indexes on products and companies
    op.execute("""
        CREATE INDEX idx_products_fts ON products USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));
        CREATE INDEX idx_companies_fts ON companies USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));
    """)


def downgrade() -> None:
    # Drop full-text indexes first
    op.execute("DROP INDEX IF EXISTS idx_products_fts;")
    op.execute("DROP INDEX IF EXISTS idx_companies_fts;")

    # Drop tables in reverse topological order
    tables = [
        'system_settings',
        'audit_logs',
        'market_insights',
        'knowledge_chunks',
        'ai_recommendations',
        'ai_searches',
        'saved_items',
        'reviews',
        'notifications',
        'messages',
        'document_extractions',
        'documents',
        'shipment_events',
        'shipments',
        'payments',
        'order_items',
        'orders',
        'quotations',
        'rfq_items',
        'rfqs',
        'price_tiers',
        'product_images',
        'products',
        'supplier_certifications',
        'certifications',
        'categories',
        'suppliers',
        'buyers',
        'companies',
        'users',
        'roles',
    ]

    for table in tables:
        op.drop_table(table)

    # Disable pgvector extension
    op.execute("DROP EXTENSION IF EXISTS vector;")
