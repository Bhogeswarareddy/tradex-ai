"""
TradeX AI Secure Admin Bootstrap CLI (Prompt 14)

Usage:
  python -m app.cli create-admin [--force]
"""
import argparse
import os
import sys
import uuid
from sqlalchemy import select

from app.core.db import SyncSessionLocal
from app.core.security import get_password_hash, validate_password_strength
from app.models.ai_ops import AuditLog
from app.models.identity import Role, User


def create_admin(force: bool = False) -> int:
    session = SyncSessionLocal()
    try:
        # 1. Check if admin already exists
        existing_admin = session.execute(
            select(User).where(User.role == "admin", User.deleted_at.is_(None)).limit(1)
        ).scalar_one_or_none()

        if existing_admin and not force:
            print("ERROR: An administrator already exists on this TradeX instance.", file=sys.stderr)
            print("Use --force if you intentionally wish to provision an additional administrator.", file=sys.stderr)
            return 1

        # 2. Read credentials from env or prompt
        email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "").strip()
        password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "").strip()

        if not email:
            try:
                email = input("Enter Admin Email: ").strip()
            except EOFError:
                print("ERROR: Admin email required via ADMIN_BOOTSTRAP_EMAIL or prompt.", file=sys.stderr)
                return 1

        if not password:
            try:
                import getpass
                password = getpass.getpass("Enter Admin Password: ").strip()
            except EOFError:
                print("ERROR: Admin password required via ADMIN_BOOTSTRAP_PASSWORD or prompt.", file=sys.stderr)
                return 1

        # 3. Enforce strong password policy for admins
        valid_pwd, msg = validate_password_strength(password)
        if not valid_pwd:
            print(f"ERROR: Strong password policy violation: {msg}", file=sys.stderr)
            return 1

        # 4. Check if user with email already exists
        user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        role_obj = session.execute(select(Role).where(Role.name == "admin")).scalar_one_or_none()

        if user:
            # Upgrade existing user to admin if forced
            user.role = "admin"
            user.role_id = role_obj.id if role_obj else None
            user.password_hash = get_password_hash(password)
            user.is_active = True
            user.failed_login_attempts = 0
            user.locked_until = None
            session.add(user)
            print(f"Existing user '{email}' has been promoted to administrator.")
        else:
            user = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=get_password_hash(password),
                full_name="Platform Administrator",
                role="admin",
                role_id=role_obj.id if role_obj else None,
                is_active=True,
                email_verified=True,
            )
            session.add(user)
            print(f"Admin account '{email}' created successfully.")

        session.flush()

        # 5. Record immutable audit log
        audit = AuditLog(
            user_id=user.id,
            action="ADMIN_BOOTSTRAP",
            entity_type="user",
            entity_id=str(user.id),
            details={"email": user.email, "forced": force},
        )
        session.add(audit)
        session.commit()
        print(f"Admin bootstrap audit record recorded. Account ready.")
        return 0

    except Exception as exc:
        session.rollback()
        print(f"ERROR during admin bootstrap: {exc}", file=sys.stderr)
        return 1
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="TradeX AI Command Line Interface")
    subparsers = parser.add_subparsers(dest="command")

    admin_parser = subparsers.add_parser("create-admin", help="Bootstrap initial platform administrator")
    admin_parser.add_argument("--force", action="store_true", help="Force create administrator even if one exists")

    args = parser.parse_args()

    if args.command == "create-admin":
        sys.exit(create_admin(force=args.force))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
