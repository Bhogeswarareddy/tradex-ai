"""
TradeX AI Database Seed Script
Idempotent data generation for realistic B2B trade simulation.
Usage: python -m app.seed
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SyncSessionLocal
from app.models import (
    Base, Buyer, Category, Certification, Company, Order, OrderItem,
    Payment, PriceTier, Product, ProductImage, Quotation, RFQ, RFQItem,
    Role, Shipment, ShipmentEvent, Supplier, SupplierCertification, User
)

import bcrypt

def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def seed():
    session: Session = SyncSessionLocal()
    print("=== Starting TradeX AI Database Seed ===")

    try:
        # 1. Roles
        roles_data = [
            ("buyer", "B2B Buyer and Importer"),
            ("supplier", "Verified Exporter and Manufacturer"),
            ("admin", "Platform Administrator"),
        ]
        roles_dict = {}
        for role_name, desc in roles_data:
            role = session.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
            if not role:
                role = Role(name=role_name, description=desc)
                session.add(role)
                session.flush()
            roles_dict[role_name] = role

        # 2. Demo Users
        demo_users = [
            ("bhogeswara@tradex.ai", "buyer123", "buyer", "Bhogeswara Reddy (Global Importer)"),
            ("supplier@sribharat.com", "supplier123", "supplier", "Ramesh Kumar (Sri Bharat Spices)"),
            ("admin@tradex.ai", "admin123", "admin", "TradeX System Admin"),
        ]
        users_dict = {}
        for email, pwd, role_str, full_name in demo_users:
            user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
            if not user:
                user = User(
                    email=email,
                    password_hash=hash_password(pwd),
                    role=role_str,
                    role_id=roles_dict[role_str].id,
                    is_active=True,
                    email_verified=True,
                    full_name=full_name,
                )
                session.add(user)
                session.flush()
            users_dict[email] = user

        # 3. Buyer Company & Profile
        buyer_company = session.execute(select(Company).where(Company.name == "Reddy Global Trading GmbH")).scalar_one_or_none()
        if not buyer_company:
            buyer_company = Company(
                name="Reddy Global Trading GmbH",
                country="Germany",
                city="Hamburg",
                website="https://reddy-trading.de",
                description="European import house specializing in organic spices and agricultural commodities.",
                years_in_business=14,
                verified_status="verified",
            )
            session.add(buyer_company)
            session.flush()

        buyer_profile = session.execute(select(Buyer).where(Buyer.user_id == users_dict["bhogeswara@tradex.ai"].id)).scalar_one_or_none()
        if not buyer_profile:
            buyer_profile = Buyer(
                company_id=buyer_company.id,
                user_id=users_dict["bhogeswara@tradex.ai"].id,
                import_destinations=["Germany", "Netherlands", "United Kingdom", "France"],
            )
            session.add(buyer_profile)
            session.flush()

        # 4. Certifications
        certs_data = [
            ("Organic NPOP/NOP", "ORG-001", "USDA / EU Organic", "Certified Organic Agriculture Standard"),
            ("ISO 22000:2018", "ISO-22000", "International Org for Standardization", "Food Safety Management System"),
            ("FSSAI Food Safety", "FSSAI-01", "Food Safety and Standards Authority of India", "Statutory Food Authority of India"),
            ("HACCP Standard", "HACCP-01", "Global Food Safety Initiative", "Hazard Analysis Critical Control Point"),
            ("APEDA Registration", "APEDA-01", "Agricultural and Processed Food Products Export Authority", "Indian Export Promotion Council"),
            ("ISO 9001:2015", "ISO-9001", "ISO", "Quality Management Systems"),
        ]
        certs_dict = {}
        for name, code, body, desc in certs_data:
            cert = session.execute(select(Certification).where(Certification.code == code)).scalar_one_or_none()
            if not cert:
                cert = Certification(name=name, code=code, issuing_body=body, description=desc)
                session.add(cert)
                session.flush()
            certs_dict[code] = cert

        # 5. 5 Verified Suppliers
        suppliers_meta = [
            {
                "company_name": "Sri Bharat Spices Pvt Ltd",
                "city": "Guntur",
                "years": 12,
                "trust_score": 4.9,
                "on_time": 95.0,
                "capacity": "1,000+ MT/month",
                "moq": 1000,
                "email": "supplier@sribharat.com",
                "certs": ["ORG-001", "ISO-22000"],
                "exports": ["Germany", "USA", "UK", "Japan", "UAE"],
                "response_hrs": 4.0,
            },
            {
                "company_name": "Madhav Agro Exports",
                "city": "Ahmedabad",
                "years": 8,
                "trust_score": 4.7,
                "on_time": 92.0,
                "capacity": "750 MT/month",
                "moq": 500,
                "email": "contact@madhavagro.com",
                "certs": ["FSSAI-01", "ORG-001"],
                "exports": ["Germany", "Canada", "Singapore", "Australia"],
                "response_hrs": 6.0,
            },
            {
                "company_name": "NatureFarm Global",
                "city": "Kochi",
                "years": 15,
                "trust_score": 4.8,
                "on_time": 98.0,
                "capacity": "2,000 MT/month",
                "moq": 2000,
                "email": "exports@naturefarmglobal.com",
                "certs": ["ORG-001", "HACCP-01"],
                "exports": ["Germany", "France", "USA", "Netherlands"],
                "response_hrs": 3.0,
            },
            {
                "company_name": "Vijaya Export House",
                "city": "Vijayawada",
                "years": 10,
                "trust_score": 4.6,
                "on_time": 90.0,
                "capacity": "600 MT/month",
                "moq": 1000,
                "email": "sales@vijayaexports.com",
                "certs": ["ISO-22000", "APEDA-01"],
                "exports": ["Germany", "UK", "Malaysia", "UAE"],
                "response_hrs": 8.0,
            },
            {
                "company_name": "Shree Spices India",
                "city": "Mumbai",
                "years": 6,
                "trust_score": 4.5,
                "on_time": 88.0,
                "capacity": "500 MT/month",
                "moq": 500,
                "email": "trade@shreespices.com",
                "certs": ["ISO-9001", "FSSAI-01"],
                "exports": ["Germany", "Saudi Arabia", "South Africa"],
                "response_hrs": 12.0,
            },
        ]

        suppliers_dict = {}
        for sm in suppliers_meta:
            # Check or create supplier user if not Sri Bharat
            if sm["email"] not in users_dict:
                s_user = session.execute(select(User).where(User.email == sm["email"])).scalar_one_or_none()
                if not s_user:
                    s_user = User(
                        email=sm["email"],
                        password_hash=hash_password("supplier123"),
                        role="supplier",
                        role_id=roles_dict["supplier"].id,
                        is_active=True,
                        email_verified=True,
                        full_name=f"{sm['company_name']} Rep",
                    )
                    session.add(s_user)
                    session.flush()
                users_dict[sm["email"]] = s_user

            comp = session.execute(select(Company).where(Company.name == sm["company_name"])).scalar_one_or_none()
            if not comp:
                comp = Company(
                    name=sm["company_name"],
                    country="India",
                    city=sm["city"],
                    website=f"https://www.{sm['company_name'].lower().replace(' ', '')}.com",
                    description=f"Premier manufacturer and exporter with {sm['years']} years of global supply track record.",
                    years_in_business=sm["years"],
                    verified_status="verified",
                )
                session.add(comp)
                session.flush()

            supp = session.execute(select(Supplier).where(Supplier.company_id == comp.id)).scalar_one_or_none()
            if not supp:
                supp = Supplier(
                    company_id=comp.id,
                    user_id=users_dict[sm["email"]].id,
                    trust_score=sm["trust_score"],
                    on_time_rate=sm["on_time"],
                    capacity_per_month=sm["capacity"],
                    export_countries=sm["exports"],
                    response_time_hours=sm["response_hrs"],
                )
                session.add(supp)
                session.flush()

                # Attach certifications
                for c_code in sm["certs"]:
                    sc = SupplierCertification(
                        supplier_id=supp.id,
                        certification_id=certs_dict[c_code].id,
                        certificate_no=f"CERT-{c_code}-{sm['years']}Y",
                        issued_at=date(2023, 1, 15),
                        expires_at=date(2028, 1, 15),
                    )
                    session.add(sc)
                session.flush()

            suppliers_dict[sm["company_name"]] = supp

        # 6. Categories (Tree structure)
        categories_data = [
            ("Spices & Condiments", "spices", "Pure whole and powdered export-grade spices", None),
            ("Agricultural Commodities", "agri", "Grains, oilseeds, and pulses in bulk", None),
            ("Textiles & Yarns", "textiles", "Export-grade natural yarns and woven fabrics", None),
            ("Industrial Machinery & Parts", "machinery", "High-precision components and tooling", None),
        ]
        cats_dict = {}
        for cname, cslug, cdesc, cparent in categories_data:
            cat = session.execute(select(Category).where(Category.slug == cslug)).scalar_one_or_none()
            if not cat:
                cat = Category(name=cname, slug=cslug, description=cdesc, parent_id=cparent)
                session.add(cat)
                session.flush()
            cats_dict[cslug] = cat

        # 7. 60 Products across 4 categories (15 each)
        product_catalog_specs = [
            # Spices (15)
            ("Organic Turmeric Powder 5% Curcumin", "organic-turmeric-powder-5-percent", "spices", "Sri Bharat Spices Pvt Ltd", "0910.30", 1000, 2.90, "kg"),
            ("Salem High-Curcumin Turmeric Finger", "salem-turmeric-finger", "spices", "Sri Bharat Spices Pvt Ltd", "0910.30", 1000, 2.60, "kg"),
            ("Guntur S4 Sannam Red Chilli Powder", "guntur-s4-sannam-chilli-powder", "spices", "Sri Bharat Spices Pvt Ltd", "0904.22", 500, 3.40, "kg"),
            ("Teja Dried Whole Red Chilli Stemless", "teja-whole-red-chilli-stemless", "spices", "Sri Bharat Spices Pvt Ltd", "0904.21", 500, 3.80, "kg"),
            ("Cumin Seeds Premium Machine Cleaned", "cumin-seeds-premium-clean", "spices", "Madhav Agro Exports", "0909.31", 1000, 4.20, "kg"),
            ("Organic Ground Cumin Powder", "organic-ground-cumin-powder", "spices", "Madhav Agro Exports", "0909.32", 500, 4.60, "kg"),
            ("Malabar Black Pepper 550GL Garbled", "malabar-black-pepper-550gl", "spices", "NatureFarm Global", "0904.11", 500, 6.80, "kg"),
            ("Tellicherry Bold Extra Special Pepper", "tellicherry-bold-black-pepper", "spices", "NatureFarm Global", "0904.11", 200, 8.50, "kg"),
            ("Green Cardamom 8mm Bold Grade A", "green-cardamom-8mm-bold", "spices", "NatureFarm Global", "0908.31", 100, 24.50, "kg"),
            ("Coriander Seeds Eagle Grade Split-Free", "coriander-seeds-eagle-grade", "spices", "Vijaya Export House", "0909.21", 1000, 1.95, "kg"),
            ("Dry Ginger Powder Bleached & Unbleached", "dry-ginger-powder-export", "spices", "Vijaya Export House", "0910.12", 500, 3.80, "kg"),
            ("Zanzibar Whole Cloves Lal Pari", "whole-cloves-lal-pari", "spices", "Shree Spices India", "0907.10", 200, 9.20, "kg"),
            ("Cassia Cinnamon Rolls Selected Split", "cassia-cinnamon-rolls", "spices", "Shree Spices India", "0906.11", 500, 4.10, "kg"),
            ("Fennel Seeds Green Bold Sortex", "fennel-seeds-green-bold", "spices", "Madhav Agro Exports", "0909.61", 500, 2.75, "kg"),
            ("Fenugreek Seeds Small Machine Clean", "fenugreek-seeds-machine-clean", "spices", "Vijaya Export House", "0910.99", 1000, 1.45, "kg"),

            # Agri (15)
            ("Traditional Basmati Rice 1121 Steam", "traditional-basmati-rice-1121", "agri", "NatureFarm Global", "1006.30", 5000, 1.45, "kg"),
            ("Pusa Basmati Rice Golden Sella", "pusa-basmati-golden-sella", "agri", "Madhav Agro Exports", "1006.30", 5000, 1.30, "kg"),
            ("PR11 Non-Basmati Long Grain Rice", "pr11-non-basmati-rice", "agri", "Vijaya Export House", "1006.30", 10000, 0.65, "kg"),
            ("Natural White Sesame Seeds 99.95% Purity", "natural-white-sesame-seeds", "agri", "Madhav Agro Exports", "1207.40", 2000, 2.20, "kg"),
            ("Hulled Sesame Seeds Auto-Sortex 99.98%", "hulled-sesame-seeds-auto-sortex", "agri", "Madhav Agro Exports", "1207.40", 2000, 2.65, "kg"),
            ("Non-GMO Yellow Maize Animal Feed Grade", "non-gmo-yellow-maize-feed", "agri", "Vijaya Export House", "1005.90", 20000, 0.32, "kg"),
            ("Soybean Meal De-Oiled Cake 48% Protein", "soybean-meal-doc-48", "agri", "NatureFarm Global", "2304.00", 15000, 0.58, "kg"),
            ("Kabuli Chickpeas 9mm Bold Export Grade", "kabuli-chickpeas-9mm-bold", "agri", "Sri Bharat Spices Pvt Ltd", "0713.20", 2000, 1.65, "kg"),
            ("Desi Chickpeas Machine Cleaned", "desi-chickpeas-machine-cleaned", "agri", "Shree Spices India", "0713.20", 3000, 1.15, "kg"),
            ("Red Kidney Beans Rajma Dark Red", "red-kidney-beans-dark-red", "agri", "Madhav Agro Exports", "0713.33", 2000, 1.85, "kg"),
            ("Bold Peanuts Java 50/60 Count", "bold-peanuts-java-50-60", "agri", "Sri Bharat Spices Pvt Ltd", "1202.42", 2000, 1.45, "kg"),
            ("Milling Wheat Hard Red Winter Equivalent", "milling-wheat-hard-red", "agri", "Vijaya Export House", "1001.99", 25000, 0.36, "kg"),
            ("Green Mung Beans Whole Shiny Grade", "green-mung-beans-shiny", "agri", "NatureFarm Global", "0713.31", 2000, 1.55, "kg"),
            ("Red Lentils Football Type Sortex", "red-lentils-football-type", "agri", "Shree Spices India", "0713.40", 5000, 0.95, "kg"),
            ("Raw Cashew Nuts W240 Export Quality", "raw-cashew-nuts-w240", "agri", "NatureFarm Global", "0801.32", 1000, 8.90, "kg"),

            # Textiles (15)
            ("100% Organic Raw Cotton Bales Shankar-6", "organic-cotton-bales-shankar-6", "textiles", "Sri Bharat Spices Pvt Ltd", "5201.00", 5000, 2.10, "kg"),
            ("Combed Ring-Spun Cotton Yarn 30s Ne", "combed-cotton-yarn-30s", "textiles", "Vijaya Export House", "5205.23", 2000, 3.85, "kg"),
            ("Carded Cotton Weaving Yarn 20s Ne", "carded-cotton-yarn-20s", "textiles", "Vijaya Export House", "5205.12", 2000, 3.20, "kg"),
            ("Compact Combed Cotton Knitting Yarn 40s", "compact-combed-cotton-yarn-40s", "textiles", "Vijaya Export House", "5205.24", 1500, 4.40, "kg"),
            ("Grey Greige Cotton Sheeting Fabric 200TC", "grey-cotton-fabric-200tc", "textiles", "Vijaya Export House", "5208.11", 5000, 1.75, "meter"),
            ("Dyed 100% Cotton Twill Fabric 240 GSM", "dyed-cotton-twill-240gsm", "textiles", "Shree Spices India", "5209.32", 3000, 2.90, "meter"),
            ("Indigo Denim Fabric 12.5 oz Ring Spun", "indigo-denim-fabric-12-5oz", "textiles", "Shree Spices India", "5209.42", 2000, 4.10, "meter"),
            ("Organic Heavyweight Cotton Canvas 14 oz", "organic-cotton-canvas-14oz", "textiles", "NatureFarm Global", "5209.11", 1000, 3.60, "meter"),
            ("Bleached Plain Cotton Sheeting 60x60", "bleached-cotton-sheeting-60x60", "textiles", "Vijaya Export House", "5208.21", 5000, 1.85, "meter"),
            ("Single Jersey Cotton Spandex Knit Fabric", "single-jersey-cotton-spandex", "textiles", "Shree Spices India", "6006.22", 1000, 5.20, "kg"),
            ("Bamboo Cotton Blend Yarn 30s Eco", "bamboo-cotton-blend-yarn", "textiles", "NatureFarm Global", "5510.11", 1000, 4.75, "kg"),
            ("Micro Modal Soft Spinning Yarn 40s", "micro-modal-spinning-yarn", "textiles", "NatureFarm Global", "5510.12", 1000, 5.60, "kg"),
            ("Reactive Printed Calico Cotton Sheeting", "printed-calico-cotton-sheeting", "textiles", "Vijaya Export House", "5208.52", 3000, 2.30, "meter"),
            ("Pure Flax Linen Yarn Wet Spun 14 Lea", "pure-flax-linen-yarn-14lea", "textiles", "NatureFarm Global", "5306.10", 500, 9.80, "kg"),
            ("Industrial Cotton Duck Fabric 18 oz", "industrial-cotton-duck-18oz", "textiles", "Sri Bharat Spices Pvt Ltd", "5209.12", 1000, 4.50, "meter"),

            # Machinery (15)
            ("Forged Alloy Steel Crankshaft 4-Cylinder", "forged-steel-crankshaft-4cyl", "machinery", "Madhav Agro Exports", "8483.10", 50, 125.00, "piece"),
            ("Ventilated Cast Iron Brake Discs Front", "ventilated-brake-discs-front", "machinery", "Madhav Agro Exports", "8708.30", 100, 32.50, "piece"),
            ("High Pressure Die-Cast Aluminum Gearbox Housing", "die-cast-aluminum-gearbox-housing", "machinery", "Madhav Agro Exports", "8708.40", 50, 85.00, "piece"),
            ("Common Rail High Pressure Fuel Injection Pipes", "common-rail-fuel-pipes", "machinery", "Shree Spices India", "8409.91", 200, 18.20, "piece"),
            ("Precision CNC Machined Steering Knuckle", "cnc-steering-knuckle-forged", "machinery", "Madhav Agro Exports", "8708.70", 100, 44.00, "piece"),
            ("Sintered Bronze Self-Lubricating Bushing", "sintered-bronze-bushing-sleeve", "machinery", "Shree Spices India", "8483.30", 1000, 2.10, "piece"),
            ("Hardened Hydraulic Piston Pump Drive Shaft", "hydraulic-pump-drive-shaft", "machinery", "Shree Spices India", "8413.91", 100, 56.00, "piece"),
            ("Stainless Exhaust Manifold Flange & Tube Assembly", "stainless-exhaust-manifold-assembly", "machinery", "Madhav Agro Exports", "8708.92", 50, 78.00, "piece"),
            ("Forged Aluminum Alloy Wheel Hubs 5-Lug", "forged-alloy-wheel-hubs-5lug", "machinery", "Madhav Agro Exports", "8708.70", 100, 48.00, "piece"),
            ("Helical Transmission Drive Gears Module 3", "helical-transmission-drive-gears", "machinery", "Madhav Agro Exports", "8483.40", 100, 28.50, "piece"),
            ("Sintered Powder Metal Valve Guide Bushings", "powder-metal-valve-guide-bushings", "machinery", "Shree Spices India", "8409.91", 2000, 1.45, "piece"),
            ("Timing Chain Sprocket with Heat-Treated Teeth", "timing-chain-sprocket-camshaft", "machinery", "Shree Spices India", "8483.90", 200, 14.80, "piece"),
            ("Precision Machined Brass Radiator Connector Fittings", "brass-radiator-connector-fittings", "machinery", "Shree Spices India", "8708.91", 500, 4.30, "piece"),
            ("Heavy-Duty Suspension Ball Joint Tie Rod Ends", "heavy-duty-suspension-tie-rod-ends", "machinery", "Madhav Agro Exports", "8708.80", 200, 16.50, "piece"),
            ("Cast Inconel Turbocharger Turbine Wheel Housing", "turbocharger-turbine-wheel-housing", "machinery", "Madhav Agro Exports", "8414.90", 30, 210.00, "piece"),
        ]

        print(f"Checking / seeding {len(product_catalog_specs)} products...")
        for name, slug, cat_slug, supp_name, hs, moq, base_price, unit in product_catalog_specs:
            prod = session.execute(select(Product).where(Product.slug == slug)).scalar_one_or_none()
            supp = suppliers_dict[supp_name]
            cat = cats_dict[cat_slug]

            if not prod:
                prod = Product(
                    supplier_id=supp.id,
                    category_id=cat.id,
                    name=name,
                    slug=slug,
                    description=f"Export-certified {name}. Origin India. Conforms to EU/US importing specifications.",
                    hs_code=hs,
                    moq=moq,
                    unit=unit,
                    origin_country="India",
                    lead_time_days=15,
                    is_active=True,
                )
                session.add(prod)
                session.flush()

                # Add image
                img = ProductImage(
                    product_id=prod.id,
                    image_url=f"https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80",
                    is_primary=True,
                    display_order=1,
                )
                session.add(img)

                # Add 3 price tiers
                tier1 = PriceTier(
                    product_id=prod.id,
                    min_qty=moq,
                    max_qty=moq * 5,
                    unit_price=Decimal(str(base_price)),
                    currency="EUR" if cat_slug in ["spices", "agri"] else "USD",
                )
                tier2 = PriceTier(
                    product_id=prod.id,
                    min_qty=(moq * 5) + 1,
                    max_qty=moq * 20,
                    unit_price=Decimal(str(round(base_price * 0.94, 2))),
                    currency="EUR" if cat_slug in ["spices", "agri"] else "USD",
                )
                tier3 = PriceTier(
                    product_id=prod.id,
                    min_qty=(moq * 20) + 1,
                    max_qty=None,
                    unit_price=Decimal(str(round(base_price * 0.88, 2))),
                    currency="EUR" if cat_slug in ["spices", "agri"] else "USD",
                )
                session.add_all([tier1, tier2, tier3])

        session.flush()

        # 8. RFQ-2026-1042: Organic Turmeric Powder
        rfq_num = "RFQ-2026-1042"
        rfq = session.execute(select(RFQ).where(RFQ.rfq_number == rfq_num)).scalar_one_or_none()
        if not rfq:
            rfq = RFQ(
                rfq_number=rfq_num,
                buyer_id=buyer_profile.id,
                title="Organic Turmeric Powder (High Curcumin, EU Certified)",
                status="evaluating",
                quantity=20000,
                unit="kg",
                target_price_min=Decimal("2.80"),
                target_price_max=Decimal("3.20"),
                currency="EUR",
                destination_country="Germany",
                destination_port="Hamburg",
                deadline=date(2026, 10, 15),
                incoterm="CIF",
                notes="Requires minimum 5% curcumin content, Eurofins pesticide residue test report, and EU Organic certificate.",
            )
            session.add(rfq)
            session.flush()

            turmeric_prod = session.execute(select(Product).where(Product.slug == "organic-turmeric-powder-5-percent")).scalar_one_or_none()
            rfq_item = RFQItem(
                rfq_id=rfq.id,
                product_id=turmeric_prod.id if turmeric_prod else None,
                item_name="Organic Turmeric Powder 5% Curcumin",
                quantity=20000,
                unit="kg",
                target_price=Decimal("3.00"),
                specifications={"curcumin": ">=5.0%", "moisture": "<=9%", "packaging": "25kg vacuum sealed multi-wall paper bags"},
            )
            session.add(rfq_item)
            session.flush()

            # 5 Comparative Quotations from the 5 suppliers
            quotes_specs = [
                ("QT-2026-001", "Sri Bharat Spices Pvt Ltd", 2.85, 3.02, 0.17, 18, "LC at sight, 30% advance", 96.5, date(2026, 11, 15)),
                ("QT-2026-002", "NatureFarm Global", 2.95, 3.10, 0.15, 14, "100% Irrevocable LC", 94.2, date(2026, 11, 20)),
                ("QT-2026-003", "Madhav Agro Exports", 2.80, 3.08, 0.28, 22, "TT 20% advance, 80% against BL", 91.0, date(2026, 11, 10)),
                ("QT-2026-004", "Vijaya Export House", 3.10, 3.25, 0.15, 16, "LC 60 days", 88.5, date(2026, 11, 18)),
                ("QT-2026-005", "Shree Spices India", 3.15, 3.32, 0.17, 20, "LC at sight", 85.0, date(2026, 11, 12)),
            ]

            winning_quote = None
            for q_num, s_name, u_price, l_cost, f_cost, l_days, terms, score, v_until in quotes_specs:
                s_obj = suppliers_dict[s_name]
                q_inst = Quotation(
                    quote_number=q_num,
                    rfq_id=rfq.id,
                    supplier_id=s_obj.id,
                    unit_price=Decimal(str(u_price)),
                    landed_cost=Decimal(str(l_cost)),
                    freight_cost=Decimal(str(f_cost)),
                    lead_time_days=l_days,
                    payment_terms=terms,
                    valid_until=v_until,
                    status="accepted" if q_num == "QT-2026-001" else "submitted",
                    ai_score=score,
                    notes=f"Competitive quote from {s_name} with complete laboratory analysis certificates.",
                )
                session.add(q_inst)
                session.flush()
                if q_num == "QT-2026-001":
                    winning_quote = q_inst

            # 9. Order & Shipment EX2026-1024 for Winning Quote (Sri Bharat Spices)
            if winning_quote:
                ord_num = "ORD-2026-0891"
                order = session.execute(select(Order).where(Order.order_number == ord_num)).scalar_one_or_none()
                if not order:
                    order = Order(
                        order_number=ord_num,
                        rfq_id=rfq.id,
                        quotation_id=winning_quote.id,
                        buyer_id=buyer_profile.id,
                        supplier_id=winning_quote.supplier_id,
                        total_amount=Decimal(str(2.85 * 20000)),
                        currency="EUR",
                        status="in_production",
                        incoterm="CIF Hamburg",
                    )
                    session.add(order)
                    session.flush()

                    order_item = OrderItem(
                        order_id=order.id,
                        product_id=turmeric_prod.id if turmeric_prod else None,
                        name="Organic Turmeric Powder 5% Curcumin",
                        quantity=20000,
                        unit="kg",
                        unit_price=Decimal("2.85"),
                        total_price=Decimal(str(2.85 * 20000)),
                    )
                    session.add(order_item)

                    payment = Payment(
                        order_id=order.id,
                        amount=Decimal(str(2.85 * 20000)),
                        currency="EUR",
                        status="escrow_locked",
                        payment_method="Escrow",
                        simulated=True,
                        transaction_ref="SIM-TXN-EUR-57000",
                    )
                    session.add(payment)

                    shipment = Shipment(
                        shipment_number="EX2026-1024",
                        order_id=order.id,
                        carrier="Maersk Line (Container 40ft High Cube)",
                        tracking_number="MAEU-98218721",
                        origin="Port of Nhava Sheva (INNSA), India",
                        destination="Port of Hamburg (DEHAM), Germany",
                        estimated_delivery=date(2026, 11, 2),
                        status="in_transit",
                    )
                    session.add(shipment)
                    session.flush()

                    # Shipment events timeline
                    now_utc = datetime.now(timezone.utc)
                    events = [
                        ShipmentEvent(
                            shipment_id=shipment.id,
                            event_type="GATE_IN",
                            status="completed",
                            location="Nhava Sheva Container Terminal, India",
                            description="Container loaded and gated in at terminal.",
                            occurred_at=now_utc - timedelta(days=7),
                        ),
                        ShipmentEvent(
                            shipment_id=shipment.id,
                            event_type="CUSTOMS_CLEARED",
                            status="completed",
                            location="Nhava Sheva Customs",
                            description="Export customs clearance completed successfully.",
                            occurred_at=now_utc - timedelta(days=6),
                        ),
                        ShipmentEvent(
                            shipment_id=shipment.id,
                            event_type="VESSEL_DEPARTED",
                            status="completed",
                            location="Arabian Sea (Vessel: Maersk Mc-Kinney)",
                            description="Vessel departed port of origin en route to Hamburg.",
                            occurred_at=now_utc - timedelta(days=4),
                        ),
                        ShipmentEvent(
                            shipment_id=shipment.id,
                            event_type="TRANSIT_SUEZ",
                            status="in_progress",
                            location="Red Sea / Suez Approach",
                            description="Vessel transiting standard maritime shipping lane.",
                            occurred_at=now_utc - timedelta(days=1),
                        ),
                    ]
                    session.add_all(events)

        session.commit()
        print("=== Seed Completed Successfully! ===")
        print("\n--- Demo User Credentials ---")
        print("1. Buyer:    bhogeswara@tradex.ai   / buyer123    (Reddy Global Trading GmbH, Germany)")
        print("2. Supplier: supplier@sribharat.com / supplier123 (Sri Bharat Spices Pvt Ltd, Guntur)")
        print("3. Admin:    admin@tradex.ai        / admin123    (TradeX Platform Admin)")
        print("------------------------------\n")

    except Exception as e:
        session.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        session.close()


if __name__ == "__main__":
    seed()
