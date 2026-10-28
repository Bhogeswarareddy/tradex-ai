import pytest
from sqlalchemy import func, select
from app.core.db import SyncSessionLocal
from app.models import Category, Company, Order, Product, Quotation, RFQ, Role, Shipment, Supplier, User


def test_seed_row_counts_and_invariants():
    session = SyncSessionLocal()
    try:
        # Check Roles
        roles_count = session.execute(select(func.count(Role.id))).scalar_one()
        assert roles_count >= 3, f"Expected at least 3 roles, got {roles_count}"

        # Check Demo Users
        users_count = session.execute(select(func.count(User.id))).scalar_one()
        assert users_count >= 3, f"Expected at least 3 users, got {users_count}"

        # Check Suppliers
        suppliers_count = session.execute(select(func.count(Supplier.id))).scalar_one()
        assert suppliers_count >= 5, f"Expected at least 5 suppliers, got {suppliers_count}"

        # Check 60+ Products
        products_count = session.execute(select(func.count(Product.id))).scalar_one()
        assert products_count >= 60, f"Expected at least 60 products, got {products_count}"

        # Check 4 Categories
        categories_count = session.execute(select(func.count(Category.id))).scalar_one()
        assert categories_count >= 4, f"Expected 4 categories, got {categories_count}"

        # Check RFQ-2026-1042
        rfq = session.execute(select(RFQ).where(RFQ.rfq_number == "RFQ-2026-1042")).scalar_one_or_none()
        assert rfq is not None, "RFQ-2026-1042 not found"
        assert rfq.quantity == 20000

        # Check 5 Quotations
        quotes_count = session.execute(select(func.count(Quotation.id)).where(Quotation.rfq_id == rfq.id)).scalar_one()
        assert quotes_count == 5, f"Expected 5 quotations for RFQ-2026-1042, got {quotes_count}"

        # Check Shipment EX2026-1024
        shipment = session.execute(select(Shipment).where(Shipment.shipment_number == "EX2026-1024")).scalar_one_or_none()
        assert shipment is not None, "Shipment EX2026-1024 not found"
        assert shipment.status == "in_transit"

    finally:
        session.close()
