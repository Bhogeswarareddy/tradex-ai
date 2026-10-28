"""
TradeX AI Database Seed Script
Idempotent data generation for realistic B2B trade simulation.
Usage: python -m app.seed
"""
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SyncSessionLocal
from app.models import (
    Base, Buyer, Category, Certification, Company, Order, OrderItem,
    Payment, PriceTier, Product, ProductImage, Quotation, Review, RFQ, RFQItem,
    Role, Shipment, ShipmentEvent, Supplier, SupplierCertification, User,
    SimulatedFreightRate, SimulatedTariffDuty, SimulatedPortHandlingFee, SimulatedExchangeRate,
    Thread, Message, Notification
)
from app.models.content import Document, DocumentExtraction

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

        # 2. Demo Users & Production Environment Check
        current_env = os.getenv("ENV", "development").lower()
        if current_env == "production":
            existing_admin = session.execute(select(User).where(User.email == "admin@tradex.ai")).scalar_one_or_none()
            if existing_admin:
                raise RuntimeError("CRITICAL SECURITY ERROR: Demo admin (admin@tradex.ai) is prohibited in production!")

        demo_users = [
            ("bhogeswara@tradex.ai", "buyer123", "buyer", "Bhogeswara Reddy (Global Importer)"),
            ("supplier@sribharat.com", "supplier123", "supplier", "Ramesh Kumar (Sri Bharat Spices)"),
        ]
        # Only seed demo admin if not in production
        if current_env != "production":
            demo_users.append(("admin@tradex.ai", "admin123", "admin", "TradeX System Admin"))

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
                "state": "Andhra Pradesh",
                "years": 12,
                "trust_score": 4.9,
                "on_time": 95.0,
                "capacity": "1,000+ MT/month",
                "moq": 1000,
                "email": "supplier@sribharat.com",
                "certs": ["ORG-001", "ISO-22000", "HACCP-01", "APEDA-01"],
                "exports": ["Germany", "USA", "UK", "Japan", "UAE"],
                "response_hrs": 4.0,
                "description": "Leading exporter of premium spices from India.",
                "banner_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1600&q=80",
                "logo_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=200&q=80",
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
                    state=sm.get("state", "Andhra Pradesh" if sm["city"] in ["Guntur", "Vijayawada"] else "Gujarat" if sm["city"] == "Ahmedabad" else "Kerala" if sm["city"] == "Kochi" else "Maharashtra"),
                    website=f"https://www.{sm['company_name'].lower().replace(' ', '')}.com",
                    description=sm.get("description", f"Premier manufacturer and exporter with {sm['years']} years of global supply track record."),
                    years_in_business=sm["years"],
                    verified_status="verified",
                    banner_url=sm.get("banner_url", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1600&q=80"),
                    logo_url=sm.get("logo_url", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=200&q=80"),
                    languages=["English", "Hindi", "Telugu", "German"],
                    factory_details={
                        "facility_size": "45,000 sq ft",
                        "annual_capacity": "12,000 Metric Tons",
                        "production_lines": 6,
                        "cleanrooms": "ISO Class 8 Certified",
                        "warehouse_capacity": "10,000 MT Climate Controlled",
                        "testing_lab": "In-house NABL Accredited HPLC & GC-MS",
                        "photos": [
                            "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
                            "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80",
                            "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
                        ]
                    }
                )
                session.add(comp)
                session.flush()
            else:
                comp.state = sm.get("state", comp.state or "Andhra Pradesh")
                comp.banner_url = sm.get("banner_url", comp.banner_url or "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1600&q=80")
                comp.logo_url = sm.get("logo_url", comp.logo_url or "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=200&q=80")
                if "description" in sm:
                    comp.description = sm["description"]
                if not comp.factory_details:
                    comp.factory_details = {
                        "facility_size": "45,000 sq ft",
                        "annual_capacity": "12,000 Metric Tons",
                        "production_lines": 6,
                        "cleanrooms": "ISO Class 8 Certified",
                        "warehouse_capacity": "10,000 MT Climate Controlled",
                        "testing_lab": "In-house NABL Accredited HPLC & GC-MS",
                        "photos": [
                            "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
                            "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80",
                            "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
                        ]
                    }
                if not comp.languages:
                    comp.languages = ["English", "Hindi", "Telugu", "German"]

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
                    repeat_buyer_rate=84.0,
                    total_buyers_count=320,
                )
                session.add(supp)
                session.flush()
            else:
                supp.repeat_buyer_rate = 84.0
                supp.total_buyers_count = 320

            # Attach certifications if not present
            for c_code in sm["certs"]:
                c_entity = certs_dict.get(c_code)
                if c_entity:
                    existing_sc = session.execute(
                        select(SupplierCertification).where(
                            SupplierCertification.supplier_id == supp.id,
                            SupplierCertification.certification_id == c_entity.id
                        )
                    ).scalar_one_or_none()
                    if not existing_sc:
                        sc = SupplierCertification(
                            supplier_id=supp.id,
                            certification_id=c_entity.id,
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

        def get_seed_product_image(cat_s: str, s_slug: str) -> str:
            s = s_slug.lower()
            if "turmeric" in s:
                return "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=800&q=80"
            if "chilli" in s or "chili" in s:
                return "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=800&q=80"
            if "cumin" in s:
                return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80"
            if "pepper" in s:
                return "https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80"
            if "cardamom" in s:
                return "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=800&q=80"
            if "ginger" in s:
                return "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80"
            if "clove" in s:
                return "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=800&q=80"
            if "cinnamon" in s:
                return "https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80"
            if "fennel" in s or "fenugreek" in s or "coriander" in s:
                return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80"
            if "rice" in s:
                return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80"
            if "sesame" in s:
                return "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=800&q=80"
            if "maize" in s or "wheat" in s or "soybean" in s:
                return "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=800&q=80"
            if "chickpea" in s or "bean" in s or "lentil" in s:
                return "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=800&q=80"
            if "peanut" in s or "cashew" in s:
                return "https://images.unsplash.com/photo-1536591375315-1b8368903277?auto=format&fit=crop&w=800&q=80"
            if "cotton" in s or "yarn" in s:
                return "https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?auto=format&fit=crop&w=800&q=80"
            if "fabric" in s or "twill" in s or "sheeting" in s:
                return "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80"
            if "denim" in s:
                return "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80"
            if "linen" in s or "canvas" in s or "jersey" in s:
                return "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80"
            if "crankshaft" in s or "shaft" in s or "piston" in s:
                return "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80"
            if "brake" in s or "disc" in s:
                return "https://images.unsplash.com/photo-1600790142055-619df03207e6?auto=format&fit=crop&w=800&q=80"
            if "gear" in s or "gearbox" in s or "transmission" in s:
                return "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80"
            if "cnc" in s or "knuckle" in s or "hub" in s or "manifold" in s or "turbocharger" in s or "valve" in s or "fitting" in s or "tie-rod" in s or "bushing" in s or "pipe" in s:
                return "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80"
            if cat_s == "spices":
                return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80"
            if cat_s == "agri":
                return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80"
            if cat_s == "textiles":
                return "https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?auto=format&fit=crop&w=800&q=80"
            return "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80"

        def get_seed_product_specs(cat_s: str, p_name: str) -> dict:
            if cat_s == "spices":
                return {
                    "Purity": "≥ 99.5% Sortex Cleaned",
                    "Moisture Content": "≤ 9.0% max",
                    "Total Ash": "≤ 6.8%",
                    "Extraneous Matter": "Nil / Laboratory COA verified",
                    "Pesticide Residue": "EU & US FDA Compliant",
                    "Packaging": "25kg multi-wall kraft paper bags with inner PE food liner",
                    "Incoterms": "FOB Mundra / CIF Hamburg, Rotterdam, Felixstowe",
                }
            elif cat_s == "agri":
                return {
                    "Purity": "99.8% Double Polished Sortex Cleaned",
                    "Moisture Content": "≤ 11.5% max",
                    "Admixture": "≤ 0.5%",
                    "Broken Grains": "≤ 1.0%",
                    "Crop Year": "Current 2025/2026 Harvest",
                    "Packaging": "50kg export PP woven bags or 1 MT jumbo bulk bags",
                    "Incoterms": "FOB Kandla / CIF Jebel Ali, Rotterdam, Mersin",
                }
            elif cat_s == "textiles":
                return {
                    "Fiber Composition": "100% Export Grade Natural Cotton",
                    "Yarn Count / Density": "30s Ne Combed Ring Spun / 200 TC",
                    "Tensile Strength": "≥ 360 cN (ASTM D2256)",
                    "Color Fastness": "Grade 4-5 (ISO 105-C06)",
                    "Shrinkage": "< 3% after commercial laundering",
                    "Packaging": "Palletized export cartons (45.4 kg / box) stretch wrapped",
                    "Incoterms": "FOB Nhava Sheva / CIF Chittagong, Hamburg",
                }
            else:  # machinery
                return {
                    "Material Grade": "AISI 4340 Forged Alloy Steel / High-Tensile Cast Iron",
                    "Hardness": "28 - 34 HRC (Heat-Treated Induction Hardened)",
                    "Surface Finish": "Ra 0.4 µm Ground & Polished",
                    "Dimensional Tolerance": "ISO 2768-mK (±0.012 mm precision)",
                    "Dynamic Balancing": "ISO 1940 G2.5 balanced",
                    "Packaging": "VCI anti-corrosion barrier foil in ISPM-15 export wooden crates",
                    "Incoterms": "FOB Nhava Sheva / CIF Hamburg, Detroit, Rotterdam",
                }

        print(f"Checking / seeding {len(product_catalog_specs)} products...")
        for name, slug, cat_slug, supp_name, hs, moq, base_price, unit in product_catalog_specs:
            prod_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"tradex.product.{slug}")
            prod = session.execute(select(Product).where(Product.slug == slug)).scalar_one_or_none()
            supp = suppliers_dict[supp_name]
            cat = cats_dict[cat_slug]
            specs = get_seed_product_specs(cat_slug, name)
            img_url = get_seed_product_image(cat_slug, slug)

            if not prod:
                prod = Product(
                    id=prod_id,
                    supplier_id=supp.id,
                    category_id=cat.id,
                    name=name,
                    slug=slug,
                    description=f"Export-certified {name}. Origin India. Conforms to EU/US importing specifications. Standard trade terms FOB/CIF supported.",
                    hs_code=hs,
                    moq=moq,
                    unit=unit,
                    origin_country="India",
                    lead_time_days=15,
                    is_active=True,
                    specifications=specs,
                )
                session.add(prod)
                session.flush()
            else:
                prod.supplier_id = supp.id
                prod.category_id = cat.id
                prod.name = name
                prod.description = f"Export-certified {name}. Origin India. Conforms to EU/US importing specifications. Standard trade terms FOB/CIF supported."
                prod.hs_code = hs
                prod.moq = moq
                prod.unit = unit
                prod.origin_country = "India"
                prod.lead_time_days = 15
                prod.is_active = True
                prod.specifications = specs

            # Ensure primary image exists and matches authentic image
            primary_img = session.execute(
                select(ProductImage).where(ProductImage.product_id == prod.id, ProductImage.is_primary == True)
            ).scalar_one_or_none()
            if primary_img:
                primary_img.image_url = img_url
            else:
                img = ProductImage(
                    product_id=prod.id,
                    image_url=img_url,
                    is_primary=True,
                    display_order=1,
                )
                session.add(img)

            # Ensure price tiers exist
            existing_tiers = session.execute(
                select(PriceTier).where(PriceTier.product_id == prod.id)
            ).scalars().all()
            if not existing_tiers:
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

            # 5 Comparative Quotations from the 5 suppliers (Prompt 14 exact seed values)
            quotes_specs = [
                ("QT-2026-001", "Sri Bharat Spices Pvt Ltd", 3.10, 3.42, 0.20, 25, "LC at sight, 30% advance", 95.0, date(2026, 11, 15)),
                ("QT-2026-002", "NatureFarm Global", 3.05, 3.38, 0.20, 28, "100% Irrevocable LC", 92.0, date(2026, 11, 20)),
                ("QT-2026-003", "Madhav Agro Exports", 3.20, 3.45, 0.16, 20, "TT 20% advance, 80% against BL", 88.0, date(2026, 11, 10)),
                ("QT-2026-004", "Vijaya Export House", 3.15, 3.48, 0.22, 30, "LC 60 days", 85.0, date(2026, 11, 18)),
                ("QT-2026-005", "Shree Spices India", 3.30, 3.65, 0.23, 22, "LC at sight", 80.0, date(2026, 11, 12)),
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
                        total_amount=Decimal(str(3.10 * 20000)),
                        currency="EUR",
                        status="in_production",
                        incoterm="CIF Hamburg",
                        payment_terms="LC at sight, 30% advance",
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
                        payment_type="advance",
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
                        mode="sea",
                        vessel_or_flight="MV Ocean Star",
                        container_number="TCNU1234567",
                        freight_forwarder="OceanLink Logistics",
                        incoterm="CIF Hamburg",
                        goods="Organic Turmeric Powder, 20,000 kg",
                        eta=date(2026, 10, 14),
                        current_latitude=12.50,
                        current_longitude=50.00,
                        current_location="Gulf of Aden",
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

        # Update quotes to Prompt 14 seed values if already present
        quotes_specs = [
            ("QT-2026-001", "Sri Bharat Spices Pvt Ltd", 3.10, 3.42, 0.20, 25, "LC at sight, 30% advance", 95.0, date(2026, 11, 15)),
            ("QT-2026-002", "NatureFarm Global", 3.05, 3.38, 0.20, 28, "100% Irrevocable LC", 92.0, date(2026, 11, 20)),
            ("QT-2026-003", "Madhav Agro Exports", 3.20, 3.45, 0.16, 20, "TT 20% advance, 80% against BL", 88.0, date(2026, 11, 10)),
            ("QT-2026-004", "Vijaya Export House", 3.15, 3.48, 0.22, 30, "LC 60 days", 85.0, date(2026, 11, 18)),
            ("QT-2026-005", "Shree Spices India", 3.30, 3.65, 0.23, 22, "LC at sight", 80.0, date(2026, 11, 12)),
        ]
        for q_num, s_name, u_price, l_cost, f_cost, l_days, terms, score, v_until in quotes_specs:
            q_ex = session.execute(select(Quotation).where(Quotation.quote_number == q_num)).scalar_one_or_none()
            if q_ex:
                q_ex.unit_price = Decimal(str(u_price))
                q_ex.landed_cost = Decimal(str(l_cost))
                q_ex.freight_cost = Decimal(str(f_cost))
                q_ex.lead_time_days = l_days
                q_ex.ai_score = score
                q_ex.payment_terms = terms
        session.flush()

        # 9. Seed realistic reviews for Sri Bharat Spices Pvt Ltd
        sri_bharat_supp = session.execute(
            select(Supplier).join(Company).where(Company.name == "Sri Bharat Spices Pvt Ltd")
        ).scalar_one_or_none()
        if sri_bharat_supp and buyer_profile:
            existing_rev = session.execute(
                select(Review).where(Review.supplier_id == sri_bharat_supp.id, Review.buyer_id == buyer_profile.id)
            ).first()
            if not existing_rev:
                r1 = Review(
                    supplier_id=sri_bharat_supp.id,
                    buyer_id=buyer_profile.id,
                    rating=5,
                    title="Outstanding Curcumin Quality and Punctual Shipping",
                    comment="The organic turmeric powder arrived at Port of Hamburg exactly to specification. Curcumin test confirmed 5.2%. Will re-order regularly.",
                )
                r2 = Review(
                    supplier_id=sri_bharat_supp.id,
                    buyer_id=buyer_profile.id,
                    rating=5,
                    title="Reliable EU Compliance Documents",
                    comment="All phytosanitary, APEDA and organic transaction certificates were clean and cleared German customs without inspection delay.",
                )
                session.add_all([r1, r2])

        # 10. Seed Simulated Landed Cost Tables (Prompt 14)
        existing_freight = session.execute(select(SimulatedFreightRate)).first()
        if not existing_freight:
            freight_rates = [
                SimulatedFreightRate(
                    origin_port="Chennai",
                    origin_country="India",
                    destination_port="Hamburg",
                    destination_country="Germany",
                    container_type="20FT",
                    rate=Decimal("2400.00"),
                    currency="EUR",
                    transit_days=24,
                ),
                SimulatedFreightRate(
                    origin_port="Kochi",
                    origin_country="India",
                    destination_port="Hamburg",
                    destination_country="Germany",
                    container_type="20FT",
                    rate=Decimal("2200.00"),
                    currency="EUR",
                    transit_days=22,
                ),
                SimulatedFreightRate(
                    origin_port="Nhava Sheva",
                    origin_country="India",
                    destination_port="Hamburg",
                    destination_country="Germany",
                    container_type="20FT",
                    rate=Decimal("2100.00"),
                    currency="EUR",
                    transit_days=21,
                ),
                SimulatedFreightRate(
                    origin_port="Ho Chi Minh",
                    origin_country="Vietnam",
                    destination_port="Hamburg",
                    destination_country="Germany",
                    container_type="20FT",
                    rate=Decimal("2600.00"),
                    currency="EUR",
                    transit_days=28,
                ),
                SimulatedFreightRate(
                    origin_port="Chennai",
                    origin_country="India",
                    destination_port="Rotterdam",
                    destination_country="Netherlands",
                    container_type="20FT",
                    rate=Decimal("2350.00"),
                    currency="EUR",
                    transit_days=23,
                ),
                SimulatedFreightRate(
                    origin_port="Nhava Sheva",
                    origin_country="India",
                    destination_port="New York",
                    destination_country="United States",
                    container_type="20FT",
                    rate=Decimal("3200.00"),
                    currency="USD",
                    transit_days=32,
                ),
            ]
            session.add_all(freight_rates)

        existing_tariffs = session.execute(select(SimulatedTariffDuty)).first()
        if not existing_tariffs:
            tariff_duties = [
                SimulatedTariffDuty(
                    hs_code="0910.30",
                    destination_country="Germany",
                    duty_rate=0.0,
                    vat_tax_rate=0.07,
                    description="Turmeric (curcuma) - EU GSP Tariff Exemption",
                ),
                SimulatedTariffDuty(
                    hs_code="0910.30",
                    destination_country="United States",
                    duty_rate=0.015,
                    vat_tax_rate=0.0,
                    description="Turmeric (curcuma) - US MFN Tariff Rate 1.5%",
                ),
                SimulatedTariffDuty(
                    hs_code="0904.11",
                    destination_country="Germany",
                    duty_rate=0.04,
                    vat_tax_rate=0.07,
                    description="Black Pepper neither crushed nor ground",
                ),
                SimulatedTariffDuty(
                    hs_code="5201.00",
                    destination_country="Germany",
                    duty_rate=0.0,
                    vat_tax_rate=0.19,
                    description="Raw cotton, not carded or combed",
                ),
            ]
            session.add_all(tariff_duties)

        existing_handling = session.execute(select(SimulatedPortHandlingFee)).first()
        if not existing_handling:
            port_fees = [
                SimulatedPortHandlingFee(
                    port_name="Hamburg",
                    country="Germany",
                    terminal_handling_per_kg=Decimal("0.0350"),
                    customs_clearance_flat=Decimal("150.00"),
                    currency="EUR",
                ),
                SimulatedPortHandlingFee(
                    port_name="Rotterdam",
                    country="Netherlands",
                    terminal_handling_per_kg=Decimal("0.0320"),
                    customs_clearance_flat=Decimal("140.00"),
                    currency="EUR",
                ),
                SimulatedPortHandlingFee(
                    port_name="Chennai",
                    country="India",
                    terminal_handling_per_kg=Decimal("0.0200"),
                    customs_clearance_flat=Decimal("90.00"),
                    currency="EUR",
                ),
            ]
            session.add_all(port_fees)

        existing_fx = session.execute(select(SimulatedExchangeRate)).first()
        if not existing_fx:
            fx_rates = [
                SimulatedExchangeRate(from_currency="USD", to_currency="EUR", rate=Decimal("0.920000")),
                SimulatedExchangeRate(from_currency="EUR", to_currency="USD", rate=Decimal("1.087000")),
                SimulatedExchangeRate(from_currency="INR", to_currency="EUR", rate=Decimal("0.011000")),
                SimulatedExchangeRate(from_currency="EUR", to_currency="EUR", rate=Decimal("1.000000")),
                SimulatedExchangeRate(from_currency="USD", to_currency="USD", rate=Decimal("1.000000")),
            ]
            session.add_all(fx_rates)

        # 11. Seed Negotiation Thread & Offer History (Prompt 15)
        existing_thread = session.execute(select(Thread)).first()
        rfq_obj = session.execute(select(RFQ).where(RFQ.rfq_number == "RFQ-2026-1042")).scalar_one_or_none()
        winning_quote = session.execute(select(Quotation).where(Quotation.quote_number == "QT-2026-001")).scalar_one_or_none()
        if not existing_thread and sri_bharat_supp and buyer_profile and rfq_obj:
            # Query buyer user and supplier user
            buyer_user = session.execute(select(User).where(User.email == "bhogeswara@tradex.ai")).scalar_one_or_none()
            supp_user = session.execute(select(User).where(User.email == "supplier@sribharat.com")).scalar_one_or_none()

            thread = Thread(
                title="RFQ-2026-1042: 20 MT Organic Turmeric - Commercial Negotiation",
                rfq_id=rfq_obj.id,
                quotation_id=winning_quote.id if winning_quote else None,
                buyer_id=buyer_profile.id,
                supplier_id=sri_bharat_supp.id,
            )
            session.add(thread)
            session.flush()

            if buyer_user and supp_user:
                m1 = Message(
                    thread_id=thread.id,
                    sender_id=buyer_user.id,
                    body="Hello Sri Bharat team, we reviewed your initial quote of €3.10/kg. Given our 20 MT order size and quarterly recurring demand, could you consider €3.00/kg CIF Hamburg?",
                    message_type="offer",
                    offer_data={
                        "price": 3.00,
                        "quantity": 20000,
                        "unit": "kg",
                        "lead_time_days": 25,
                        "currency": "EUR",
                        "status": "superseded",
                        "notes": "Target budget for recurring 20 MT volume",
                    },
                    is_read=True,
                )
                m2 = Message(
                    thread_id=thread.id,
                    sender_id=supp_user.id,
                    body="Dear Bhogeswara, thank you for the inquiry. With current Guntur market mandis and certified EU organic batch testing, €3.00 is tight. We can meet you at €3.05/kg with 25 days dispatch.",
                    message_type="offer",
                    offer_data={
                        "price": 3.05,
                        "quantity": 20000,
                        "unit": "kg",
                        "lead_time_days": 25,
                        "currency": "EUR",
                        "status": "accepted",
                        "notes": "Compromise counter-offer with Eurofins test guarantee",
                    },
                    is_read=True,
                )
                m3 = Message(
                    thread_id=thread.id,
                    sender_id=buyer_user.id,
                    body="Agreed on €3.05/kg. We will issue the Purchase Order and Letter of Credit draft today.",
                    message_type="text",
                    is_read=False,
                )
                session.add_all([m1, m2, m3])

                notif = Notification(
                    user_id=buyer_user.id,
                    title="Counter-offer Accepted",
                    message="Sri Bharat Spices accepted your agreed rate of €3.05/kg CIF Hamburg for RFQ-2026-1042.",
                    event_type="counter_offer",
                    is_read=False,
                    link="/rfq/rfq-2026-1042",
                )
                session.add(notif)

        # 11. Documents and AI Document Intelligence Seed
        existing_doc = session.execute(select(Document).limit(1)).scalar_one_or_none()
        sri_supp = session.execute(
            select(Supplier).join(Company).where(Company.name == "Sri Bharat Spices Pvt Ltd")
        ).scalar_one_or_none()
        supp_user_obj = session.execute(
            select(User).where(User.email == "supplier@sribharat.com")
        ).scalar_one_or_none()
        demo_order = session.execute(
            select(Order).where(Order.order_number == "ORD-2026-0891")
        ).scalar_one_or_none()

        if not existing_doc and sri_supp and supp_user_obj:
            storage_dir = os.path.abspath(
                os.getenv("LOCAL_STORAGE_PATH") or os.getenv("STORAGE_DIR") or "storage/documents"
            )
            os.makedirs(storage_dir, exist_ok=True)
            dummy_pdf = (
                b"%PDF-1.4\n"
                b"1 0 obj\n<< /Title (TradeX Verified Trade Document) /Author (TradeX AI) >>\nendobj\n"
                b"2 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 712 Td (Trade Document Authenticated) Tj ET\nendstream\nendobj\n"
                b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
            )

            # 1. Certificate: EU Organic
            f1 = f"{uuid.uuid4().hex}.pdf"
            p1 = os.path.join(storage_dir, f1)
            with open(p1, "wb") as f:
                f.write(dummy_pdf)
            d1 = Document(
                user_id=supp_user_obj.id,
                title="EU Organic Accreditation Certificate (APEDA / Control Union)",
                original_filename="EU_Organic_Certificate_IN-BIO-149.pdf",
                file_path=p1,
                file_size=len(dummy_pdf),
                mime_type="application/pdf",
                doc_type="certificate",
                status="verified",
                supplier_id=sri_supp.id,
                expiry_date=date(2027, 10, 31),
            )
            session.add(d1)
            session.flush()

            ext1 = DocumentExtraction(
                document_id=d1.id,
                extracted_json={
                    "company_name": "Sri Bharat Spices Pvt Ltd",
                    "product": "Spices & Botanicals (Organic Turmeric, Ginger, Black Pepper)",
                    "certification_type": "EU Organic / ISO 22000:2018",
                    "certificate_number": "IN-BIO-149-CU-892110",
                    "issue_date": "2025-11-01",
                    "expiry_date": "2027-10-31",
                    "capacity": "15,000 MT/year",
                    "hs_codes": ["0910.30"],
                    "field_confidences": {
                        "company_name": 0.99,
                        "certification_type": 0.98,
                        "certificate_number": 0.99,
                        "issue_date": 0.95,
                        "expiry_date": 0.96,
                        "capacity": 0.85,
                        "hs_codes": 0.90,
                    },
                    "confidence_score": 0.96,
                    "status": "extracted",
                },
                confidence_score=0.96,
                status="confirmed",
                reviewed_by=supp_user_obj.id,
                reviewed_at=datetime.now(timezone.utc),
            )
            session.add(ext1)

            # 2. Commercial Invoice
            f2 = f"{uuid.uuid4().hex}.pdf"
            p2 = os.path.join(storage_dir, f2)
            with open(p2, "wb") as f:
                f.write(dummy_pdf)
            d2 = Document(
                user_id=supp_user_obj.id,
                title="Commercial Invoice ORD-2026-0891",
                original_filename="Commercial_Invoice_INV-2026-0891.pdf",
                file_path=p2,
                file_size=len(dummy_pdf),
                mime_type="application/pdf",
                doc_type="invoice",
                status="verified",
                supplier_id=sri_supp.id,
                order_id=demo_order.id if demo_order else None,
            )
            session.add(d2)
            session.flush()

            ext2 = DocumentExtraction(
                document_id=d2.id,
                extracted_json={
                    "company_name": "Sri Bharat Spices Pvt Ltd",
                    "product": "Organic Turmeric Powder (Alleppey Curcumin 5.2%)",
                    "invoice_amount": 57000.0,
                    "currency": "EUR",
                    "quantity": 20000.0,
                    "unit": "kg",
                    "issue_date": "2026-09-15",
                    "hs_codes": ["0910.30.00"],
                    "field_confidences": {
                        "company_name": 0.98,
                        "invoice_amount": 0.99,
                        "currency": 0.99,
                        "quantity": 0.97,
                        "unit": 0.99,
                        "issue_date": 0.95,
                        "hs_codes": 0.92,
                    },
                    "confidence_score": 0.97,
                    "status": "extracted",
                },
                confidence_score=0.97,
                status="confirmed",
                reviewed_by=supp_user_obj.id,
                reviewed_at=datetime.now(timezone.utc),
            )
            session.add(ext2)

            # 3. Bill of Lading
            f3 = f"{uuid.uuid4().hex}.pdf"
            p3 = os.path.join(storage_dir, f3)
            with open(p3, "wb") as f:
                f.write(dummy_pdf)
            d3 = Document(
                user_id=supp_user_obj.id,
                title="Ocean Bill of Lading (MAEU-98218721)",
                original_filename="Ocean_Bill_of_Lading_MAEU-98218721.pdf",
                file_path=p3,
                file_size=len(dummy_pdf),
                mime_type="application/pdf",
                doc_type="bill_of_lading",
                status="verified",
                supplier_id=sri_supp.id,
                order_id=demo_order.id if demo_order else None,
            )
            session.add(d3)
            session.flush()

            ext3 = DocumentExtraction(
                document_id=d3.id,
                extracted_json={
                    "company_name": "Sri Bharat Spices Pvt Ltd",
                    "product": "Organic Turmeric Powder, 20,000 kg",
                    "quantity": 20000.0,
                    "unit": "kg",
                    "capacity": "800 multi-wall kraft paper bags (25kg net)",
                    "issue_date": "2026-09-22",
                    "hs_codes": ["0910.30.00"],
                    "field_confidences": {
                        "company_name": 0.99,
                        "product": 0.96,
                        "quantity": 0.99,
                        "unit": 0.99,
                        "capacity": 0.90,
                        "issue_date": 0.94,
                        "hs_codes": 0.93,
                    },
                    "confidence_score": 0.96,
                    "status": "extracted",
                },
                confidence_score=0.96,
                status="confirmed",
                reviewed_by=supp_user_obj.id,
                reviewed_at=datetime.now(timezone.utc),
            )
            session.add(ext3)

            # 4. Packing List (Needs review, capacity has 65% confidence to test low confidence highlight)
            f4 = f"{uuid.uuid4().hex}.pdf"
            p4 = os.path.join(storage_dir, f4)
            with open(p4, "wb") as f:
                f.write(dummy_pdf)
            d4 = Document(
                user_id=supp_user_obj.id,
                title="Commercial Packing List & Container Plan",
                original_filename="Packing_List_ORD-2026-0891.pdf",
                file_path=p4,
                file_size=len(dummy_pdf),
                mime_type="application/pdf",
                doc_type="packing_list",
                status="needs_review",
                supplier_id=sri_supp.id,
                order_id=demo_order.id if demo_order else None,
            )
            session.add(d4)
            session.flush()

            ext4 = DocumentExtraction(
                document_id=d4.id,
                extracted_json={
                    "company_name": "Sri Bharat Spices Pvt Ltd",
                    "product": "Organic Turmeric Powder 5% Curcumin",
                    "quantity": 20000.0,
                    "unit": "kg",
                    "capacity": "800 multi-wall kraft paper bags",
                    "issue_date": "2026-09-18",
                    "hs_codes": ["0910.30.00"],
                    "field_confidences": {
                        "company_name": 0.95,
                        "product": 0.92,
                        "quantity": 0.98,
                        "unit": 0.99,
                        "capacity": 0.65,
                        "issue_date": 0.89,
                    },
                    "confidence_score": 0.88,
                    "status": "needs_review",
                },
                confidence_score=0.88,
                status="needs_review",
            )
            session.add(ext4)

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
