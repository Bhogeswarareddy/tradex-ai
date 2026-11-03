#!/usr/bin/env python3
"""
TradeX AI - Production Database Security Hardening & Demo Account Rotation
"""

import os
import sys
import secrets
from datetime import datetime

# Add app to path
sys.path.insert(0, "/app")
sys.path.insert(0, "/opt/tradex-ai/backend")

import bcrypt
from sqlalchemy import create_engine, text

def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def main():
    print("==> Starting TradeX AI Production Database Security Hardening...")

    db_url = os.getenv("SYNC_DATABASE_URL")
    if not db_url:
        pg_pass = os.getenv("POSTGRES_PASSWORD", "tradex_prod_secure_pass_992")
        db_url = f"postgresql+psycopg2://tradex_user:{pg_pass}@db:5432/tradex"

    engine = create_engine(db_url)

    # Passwords generated on host / passed via env
    new_admin_password = os.getenv("NEW_ADMIN_PASSWORD") or secrets.token_urlsafe(20)
    new_buyer_password = os.getenv("NEW_BUYER_PASSWORD") or secrets.token_urlsafe(18)
    new_supplier_password = os.getenv("NEW_SUPPLIER_PASSWORD") or secrets.token_urlsafe(18)

    admin_email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "katakambhogeswarareddy138@gmail.com")
    new_buyer_email = "partner-buyer@tradex.ai"
    new_supplier_email = "partner-supplier@tradex.ai"

    new_admin_hash = hash_password(new_admin_password)
    new_buyer_hash = hash_password(new_buyer_password)
    new_supplier_hash = hash_password(new_supplier_password)

    with engine.begin() as conn:
        # 1. Update Admin Password
        print("==> 1. Updating Platform Administrator Credentials...")
        conn.execute(
            text("UPDATE users SET password_hash = :hash, is_active = true WHERE email = :email"),
            {"hash": new_admin_hash, "email": admin_email}
        )
        print(f"    Updated admin hash for {admin_email}")

        # 2. Identify and Purge Seeded Demo Accounts
        print("==> 2. Purging and Disabling Seeded Demo Accounts & Weak Passwords...")
        demo_emails = [
            "admin@tradex.ai",
            "bhogeswara@tradex.ai",
            "buyer@speisekammer.de",
            "supplier@keralaspices.com",
            "supplier@sribharat.com",
            "prodadmin@tradex.ai",
        ]

        conn.execute(text("""
            DELETE FROM refresh_tokens 
            WHERE user_id IN (
                SELECT id FROM users 
                WHERE email = ANY(:demo_emails) 
                   OR email LIKE '%@scale.tradex.io' 
                   OR email LIKE '%@example.com'
                   OR email LIKE 'demo-%'
                   OR email LIKE 'lockout_%'
                   OR email LIKE 'intruder_%'
                   OR email LIKE 'pwd_test_%'
                   OR email LIKE 'session_test_%'
                   OR email LIKE 'profile_test_%'
                   OR email LIKE 'settings_test_%'
                   OR email LIKE 'mfa_admin_%'
            )
        """), {"demo_emails": demo_emails})

        conn.execute(text("""
            UPDATE users SET is_active = false, password_hash = 'DISABLED_DEMO_ACCOUNT'
            WHERE email = ANY(:demo_emails)
               OR email LIKE '%@scale.tradex.io'
               OR email LIKE '%@example.com'
               OR email LIKE 'demo-%'
               OR email LIKE 'lockout_%'
               OR email LIKE 'intruder_%'
               OR email LIKE 'pwd_test_%'
               OR email LIKE 'session_test_%'
               OR email LIKE 'profile_test_%'
               OR email LIKE 'settings_test_%'
               OR email LIKE 'mfa_admin_%';
        """), {"demo_emails": demo_emails})

        print("    Disabled all legacy demo accounts and revoked refresh tokens.")

        # 3. Create Two Clean Production Demo Accounts
        print("==> 3. Creating Two Clean Production Demo Accounts...")
        buyer_role_id = conn.execute(text("SELECT id FROM roles WHERE name = 'buyer'")).scalar()
        supplier_role_id = conn.execute(text("SELECT id FROM roles WHERE name = 'supplier'")).scalar()

        # Buyer User
        existing_buyer = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": new_buyer_email}).scalar()
        if existing_buyer:
            conn.execute(
                text("UPDATE users SET password_hash = :hash, is_active = true WHERE email = :email"),
                {"hash": new_buyer_hash, "email": new_buyer_email}
            )
            buyer_id = existing_buyer
        else:
            buyer_id = conn.execute(
                text("""
                    INSERT INTO users (id, email, password_hash, role, role_id, is_active, email_verified, full_name, created_at, updated_at)
                    VALUES (gen_random_uuid(), :email, :hash, 'buyer', :role_id, true, true, 'Verified Demo Buyer', now(), now())
                    RETURNING id
                """),
                {"email": new_buyer_email, "hash": new_buyer_hash, "role_id": buyer_role_id}
            ).scalar()

        # Supplier User
        existing_supplier = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": new_supplier_email}).scalar()
        if existing_supplier:
            conn.execute(
                text("UPDATE users SET password_hash = :hash, is_active = true WHERE email = :email"),
                {"hash": new_supplier_hash, "email": new_supplier_email}
            )
            supplier_id = existing_supplier
        else:
            supplier_id = conn.execute(
                text("""
                    INSERT INTO users (id, email, password_hash, role, role_id, is_active, email_verified, full_name, created_at, updated_at)
                    VALUES (gen_random_uuid(), :email, :hash, 'supplier', :role_id, true, true, 'Verified Demo Supplier', now(), now())
                    RETURNING id
                """),
                {"email": new_supplier_email, "hash": new_supplier_hash, "role_id": supplier_role_id}
            ).scalar()

        # Link Buyer to Company
        buyer_comp_id = conn.execute(text("SELECT id FROM companies WHERE name = 'Reddy Global Trading GmbH'")).scalar()
        if buyer_comp_id:
            existing_b_prof = conn.execute(text("SELECT id FROM buyers WHERE user_id = :uid"), {"uid": buyer_id}).scalar()
            if not existing_b_prof:
                conn.execute(text("""
                    INSERT INTO buyers (id, company_id, user_id, import_destinations, created_at, updated_at)
                    VALUES (gen_random_uuid(), :comp_id, :uid, ARRAY['Germany', 'Netherlands', 'UK'], now(), now())
                """), {"comp_id": buyer_comp_id, "uid": buyer_id})

        # Link Supplier to Company
        supp_comp_id = conn.execute(text("SELECT id FROM companies WHERE name = 'Sri Bharat Spices Pvt Ltd'")).scalar()
        if supp_comp_id:
            existing_s_prof = conn.execute(text("SELECT id FROM suppliers WHERE company_id = :comp_id"), {"comp_id": supp_comp_id}).scalar()
            if existing_s_prof:
                conn.execute(text("UPDATE suppliers SET user_id = :uid WHERE id = :id"), {"uid": supplier_id, "id": existing_s_prof})
            else:
                conn.execute(text("""
                    INSERT INTO suppliers (id, company_id, user_id, trust_score, on_time_rate, capacity_per_month, export_countries, response_time_hours, created_at, updated_at)
                    VALUES (gen_random_uuid(), :comp_id, :uid, 94.5, 96.0, 15000, ARRAY['Germany', 'USA'], 4.0, now(), now())
                """), {"comp_id": supp_comp_id, "uid": supplier_id})

        print("    Demo Buyer and Demo Supplier profiles verified.")

        # 4. Invariant Verification
        active_users = conn.execute(text("SELECT email, role, is_active FROM users WHERE is_active = true")).fetchall()
        print(f"==> Active production users count: {len(active_users)}")
        for u in active_users:
            print(f"    - {u[0]} ({u[1]})")

    print("==> Database operations successful!")

if __name__ == "__main__":
    main()
