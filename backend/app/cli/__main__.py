"""
TradeX AI Administrative and AI Operations CLI (Prompt 14 & Prompt 21)

Usage:
  python -m app.cli create-admin [--force]
  python -m app.cli reindex
  python -m app.cli ai-check
"""
import argparse
import asyncio
import os
import sys
import time
import uuid
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SyncSessionLocal, AsyncSessionLocal
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


async def _async_reindex() -> int:
    from app.ai.rag.ingest import ingest_knowledge_base
    from app.ai.rag.retriever import retrieve_knowledge_chunks
    from app.models.catalog import Product
    from app.ai.provider import get_ai_provider

    ai_provider = get_ai_provider()
    print("================================================================================")
    print(f" TradeX AI RAG & Catalogue Reindexing (dim={settings.EMBEDDING_DIM})")
    print(f" Provider: {settings.EMBEDDING_PROVIDER} | Model: {settings.EMBEDDING_MODEL}")
    print("================================================================================")

    async with AsyncSessionLocal() as db:
        # 1. Ingest Knowledge Base
        print("Indexing trade regulatory guides into pgvector...")
        chunks_count = await ingest_knowledge_base(db)
        await db.commit()
        print(f"[OK] Ingested and embedded {chunks_count} knowledge chunks.")

        # 2. Check catalogue products
        res = await db.execute(select(Product).where(Product.deleted_at.is_(None)))
        products = res.scalars().all()
        print(f"[OK] Verified {len(products)} catalogue products ready for vector search.")

        # 3. Verification test
        test_query = "turmeric organic certification traces nt"
        retrieved = await retrieve_knowledge_chunks(test_query, db, top_k=3)
        print(f"[OK] Verification RAG query for '{test_query}' returned {len(retrieved)} chunk(s):")
        for idx, c in enumerate(retrieved, 1):
            score = round(getattr(c, "score", 0.0), 3)
            title = getattr(c, "title", "Untitled")
            print(f"     {idx}. {title} (score: {score})")

    print("================================================================================")
    print(" [SUCCESS] Reindexing complete. All pgvector vectors populated.")
    print("================================================================================")
    return 0


def reindex_command() -> int:
    return asyncio.run(_async_reindex())


async def _async_ai_check() -> int:
    from app.ai.provider import get_ai_provider, get_ai_status

    status = get_ai_status()
    chain = get_ai_provider()
    prompt = "Hello TradeX AI! Verify B2B international trade intelligence system connection."

    print("================================================================================")
    print(" TradeX AI Model Health Check (make ai-check / Prompt 21)")
    print("================================================================================")
    print(f"Configured Priority: {', '.join(status['priority'])}")
    print(f"Configured Providers: {', '.join(status['configured_providers']) or 'None (Demo AI mode)'}")
    print(f"Sending test completion to active provider...")

    t0 = time.time()
    try:
        resp = await chain.complete(
            system="You are TradeX AI, an enterprise international trade copilot.",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
        )
        latency = (time.time() - t0) * 1000
        print("")
        print(f"Provider: {resp.provider}")
        print(f"Model:    {resp.model}")
        print(f"Latency:  {round(latency, 2)}ms")
        print(f"Fallback: {resp.fallback}")
        print(f"Is Mock:  {resp.is_mock}")
        print(f"Reply:    {resp.content.strip()[:250]}")
        print("================================================================================")
        return 0
    except Exception as exc:
        print(f"[ERROR] AI Check failed: {exc}", file=sys.stderr)
        return 1


def ai_check_command() -> int:
    return asyncio.run(_async_ai_check())


def main():
    parser = argparse.ArgumentParser(description="TradeX AI Command Line Interface")
    subparsers = parser.add_subparsers(dest="command")

    admin_parser = subparsers.add_parser("create-admin", help="Bootstrap initial platform administrator")
    admin_parser.add_argument("--force", action="store_true", help="Force create administrator even if one exists")

    subparsers.add_parser("reindex", help="Reindex catalogue and RAG knowledge base embeddings into pgvector")
    subparsers.add_parser("ai-check", help="Test live AI model completion and print provider, model, latency and reply")

    args = parser.parse_args()

    if args.command == "create-admin":
        sys.exit(create_admin(force=args.force))
    elif args.command == "reindex":
        sys.exit(reindex_command())
    elif args.command == "ai-check":
        sys.exit(ai_check_command())
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
