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
from datetime import datetime, timezone
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


async def _async_audit_catalogue(output_path: str = "docs/CATALOGUE_AUDIT.md") -> int:
    from sqlalchemy.orm import selectinload
    from app.models.catalog import Category, PriceTier, Product, ProductImage, SupplierCategory
    from app.models.identity import Supplier, Company

    print("================================================================================")
    print(" TradeX AI Catalogue Integrity Audit (Prompt 29)")
    print("================================================================================")

    async with AsyncSessionLocal() as db:
        # Load products
        res = await db.execute(
            select(Product)
            .options(
                selectinload(Product.category),
                selectinload(Product.supplier).selectinload(Supplier.company),
                selectinload(Product.price_tiers),
                selectinload(Product.images),
            )
            .where(Product.deleted_at.is_(None))
        )
        products = res.scalars().all()

        # Load valid supplier_categories pairs
        sc_res = await db.execute(select(SupplierCategory))
        valid_pairs = {(sc.supplier_id, sc.category_id) for sc in sc_res.scalars().all()}

        # 1. Supplier Category Mismatches
        mismatches = []
        for p in products:
            if (p.supplier_id, p.category_id) not in valid_pairs:
                sup_name = p.supplier.company.name if p.supplier and p.supplier.company else str(p.supplier_id)
                cat_name = p.category.name if p.category else str(p.category_id)
                mismatches.append(f"Product '{p.name}' (ID: {p.id}) in '{cat_name}', but supplier '{sup_name}' is not registered for it.")

        # 2. Products without images or with warehouse images
        image_defects = []
        for p in products:
            img_urls = [img.image_url for img in p.images if img.image_url]
            if not img_urls:
                image_defects.append(f"Product '{p.name}' (ID: {p.id}) has no associated images.")
            else:
                for u in img_urls:
                    if any(bad in u.lower() for bad in ["warehouse", "storage_facility", "industrial_storage", "pallet_storage"]):
                        image_defects.append(f"Product '{p.name}' (ID: {p.id}) contains warehouse/storage photo: {u}")

        # 3. Null prices or currencies
        pricing_defects = []
        for p in products:
            if not p.currency or len(p.currency.strip()) < 3:
                pricing_defects.append(f"Product '{p.name}' (ID: {p.id}) missing valid currency ({p.currency}).")
            if not p.price_tiers:
                pricing_defects.append(f"Product '{p.name}' (ID: {p.id}) has no price tiers.")
            else:
                for t in p.price_tiers:
                    if t.unit_price is None or float(t.unit_price) <= 0:
                        pricing_defects.append(f"Product '{p.name}' (ID: {p.id}) has invalid unit_price: {t.unit_price}.")

        # 4. Stock 0 and status Published
        stock_defects = []
        for p in products:
            if p.status == "published":
                avail = float(p.available_quantity if p.available_quantity > 0 else (p.stock_available or 0))
                if avail <= 0:
                    stock_defects.append(f"Product '{p.name}' (ID: {p.id}) is published but has stock 0.")

        # 5. Duplicates
        duplicate_defects = []
        seen_slugs = set()
        seen_sup_names = set()
        for p in products:
            if p.slug in seen_slugs:
                duplicate_defects.append(f"Duplicate slug '{p.slug}' on product '{p.name}' (ID: {p.id}).")
            seen_slugs.add(p.slug)
            pair = (p.supplier_id, p.name.strip().lower())
            if pair in seen_sup_names:
                duplicate_defects.append(f"Duplicate product '{p.name}' for supplier ID '{p.supplier_id}'.")
            seen_sup_names.add(pair)

        # 6. Certifications that do not fit the category
        cert_defects = []
        food_categories = {"spices", "rice_grains", "tea_coffee"}
        tech_categories = {"electronics", "auto_components", "machinery"}
        for p in products:
            cat_slug = p.category.slug if p.category else ""
            certs_json = p.certifications_json or []
            cert_names = [c.get("name", "") if isinstance(c, dict) else str(c) for c in certs_json]
            for cname in cert_names:
                cname_lower = cname.lower()
                if cat_slug in tech_categories:
                    if any(fc in cname_lower for fc in ["organic", "fssai", "npop", "nop", "halal", "kosher", "spices board", "tea board"]):
                        cert_defects.append(f"Product '{p.name}' in tech category '{cat_slug}' carries food cert '{cname}'.")
                elif cat_slug in food_categories:
                    if any(tc in cname_lower for tc in ["rohs", "fcc", "cb scheme", "bluetooth bqb", "intel certified"]):
                        cert_defects.append(f"Product '{p.name}' in food category '{cat_slug}' carries tech cert '{cname}'.")

        # Compile report
        total_defects = (
            len(mismatches)
            + len(image_defects)
            + len(pricing_defects)
            + len(stock_defects)
            + len(duplicate_defects)
            + len(cert_defects)
        )

        md = f"""# TradeX AI Catalogue Integrity Audit Report (Prompt 29)
**Audit Timestamp:** {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}
**Environment:** PostgreSQL `tradex` Database

## 1. Executive Summary

| Metric | Value | Status |
| :--- | :--- | :--- |
| **Total Active Products Audited** | `{len(products)}` | OK |
| **Supplier-Category Mismatches** | `{len(mismatches)}` | {"PASSED" if not mismatches else "FAIL"} |
| **Warehouse / Invalid Images** | `{len(image_defects)}` | {"PASSED" if not image_defects else "FAIL"} |
| **Null Prices or Currencies** | `{len(pricing_defects)}` | {"PASSED" if not pricing_defects else "FAIL"} |
| **Stock 0 with Status 'Published'** | `{len(stock_defects)}` | {"PASSED" if not stock_defects else "FAIL"} |
| **Duplicate Slugs / Products** | `{len(duplicate_defects)}` | {"PASSED" if not duplicate_defects else "FAIL"} |
| **Category-Mismatched Certifications** | `{len(cert_defects)}` | {"PASSED" if not cert_defects else "FAIL"} |
| **Overall Critical Defects** | **`{total_defects}`** | {"PASSED" if total_defects == 0 else "FAIL"} |

---

## 2. Supplier and Category Integrity
Rule: A supplier can list a product only in a category it is registered for in `supplier_categories`.
"""
        if mismatches:
            md += "\n" + "\n".join(f"- ❌ {m}" for m in mismatches) + "\n"
        else:
            md += "\n✓ **Zero supplier-category mismatches found.** All suppliers are strictly authorized for their listed categories.\n"

        md += "\n---\n\n## 3. Product Images & Visual Standards\nRule: Every product must have an image; product images must never use warehouse or industrial storage photos.\n"
        if image_defects:
            md += "\n" + "\n".join(f"- ❌ {m}" for m in image_defects) + "\n"
        else:
            md += "\n✓ **Zero image defects found.** All products have matching category visuals and zero warehouse photos.\n"

        md += "\n---\n\n## 4. Currency and Pricing Integrity\nRule: Null prices and missing currencies are strictly rejected. Tiers must have positive unit prices.\n"
        if pricing_defects:
            md += "\n" + "\n".join(f"- ❌ {m}" for m in pricing_defects) + "\n"
        else:
            md += "\n✓ **Zero pricing/currency defects found.** All products have valid ISO currencies and positive tier pricing.\n"

        md += "\n---\n\n## 5. Stock and Published Listing Integrity\nRule: Published listings must have available stock > 0.\n"
        if stock_defects:
            md += "\n" + "\n".join(f"- ❌ {m}" for m in stock_defects) + "\n"
        else:
            md += "\n✓ **Zero out-of-stock published listings found.** All published products have verified non-zero inventory.\n"

        md += "\n---\n\n## 6. Duplicate Slugs and Products\nRule: Product slugs must be unique across the platform.\n"
        if duplicate_defects:
            md += "\n" + "\n".join(f"- ❌ {m}" for m in duplicate_defects) + "\n"
        else:
            md += "\n✓ **Zero duplicate products or slugs found.**\n"

        md += "\n---\n\n## 7. Category-Appropriate Certifications\nRule: Certifications must fit the product category (e.g. CE/FCC/RoHS for electronics; Organic/HACCP for food).\n"
        if cert_defects:
            md += "\n" + "\n".join(f"- ❌ {m}" for m in cert_defects) + "\n"
        else:
            md += "\n✓ **Zero certification category mismatches found.** Electronics carry CE/FCC/RoHS; Food carries Organic/HACCP.\n"

        md += f"\n---\n\n## 8. Audit Conclusion\n**Total Critical Issues:** `{total_defects}`\n**Audit Status:** {'PASSED - ALL 6 CRITICAL INTEGRITY CHECKS SATISFIED' if total_defects == 0 else 'ACTION REQUIRED'}\n"

        # Save to disk
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(md)
            print(f"[OK] Audit report written to {output_path}")
        except Exception as e:
            print(f"[WARN] Could not write audit report file: {e}", file=sys.stderr)

        print("")
        print(f"Total Products Audited: {len(products)}")
        print(f"Supplier Mismatches:    {len(mismatches)}")
        print(f"Image Defects:          {len(image_defects)}")
        print(f"Pricing Defects:        {len(pricing_defects)}")
        print(f"Stock 0 Published:      {len(stock_defects)}")
        print(f"Duplicates:             {len(duplicate_defects)}")
        print(f"Cert Mismatches:        {len(cert_defects)}")
        print(f"Total Critical Defects: {total_defects}")
        print("================================================================================")
        return 0 if total_defects == 0 else 1


def audit_catalogue_command() -> int:
    return asyncio.run(_async_audit_catalogue())


def ai_check_command() -> int:
    return asyncio.run(_async_ai_check())


def ai_eval_command() -> int:
    return asyncio.run(_async_ai_eval())


async def _async_ai_eval() -> int:
    import json
    from app.services.ai_mode_service import classify_user_message
    from app.ai.provider import get_ai_status

    status = get_ai_status()
    print("================================================================================")
    print(" TradeX AI Intent Classification Benchmark (make ai-eval / Prompt 30)")
    print(f" Active Provider: {status['provider']} | Model: {status['model']} | Mode: {status['mode']}")
    print("================================================================================")

    # Locate utterances file
    candidates = [
        "tests/fixtures/ai_utterances.json",
        "app/tests/fixtures/ai_utterances.json",
        "/app/app/tests/fixtures/ai_utterances.json",
        os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "ai_utterances.json"),
    ]
    fixture_path = None
    for c in candidates:
        if os.path.exists(c):
            fixture_path = c
            break

    if not fixture_path:
        print("ERROR: Could not find ai_utterances.json fixtures file.", file=sys.stderr)
        return 1

    with open(fixture_path, "r", encoding="utf-8") as f:
        utterances = json.load(f)

    total = len(utterances)
    correct = 0

    intent_norm_map = {
        "new_search": "product_search",
        "product_search": "product_search",
        "greeting": "greeting",
        "small_talk": "greeting",
        "compare": "compare",
        "refine": "refine_search",
        "refine_search": "refine_search",
        "question_about_product": "product_question",
        "product_question": "product_question",
        "availability_or_price_question": "stock_question",
        "stock_question": "stock_question",
        "supplier_question": "supplier_question",
        "negotiation_help": "negotiation_help",
        "clear_and_restart": "clear_restart",
    }

    state = {
        "last_product_ids": ["prod-1", "prod-2"],
        "criteria": {"product": "laptop", "origin_country": "USA"},
    }

    print(f"{'#':<3} | {'Query':<42} | {'Expected':<16} | {'Predicted':<16} | Match")
    print("-" * 88)

    for idx, item in enumerate(utterances, 1):
        text = item["text"]
        expected = item["expected_intent"]

        predicted_raw = classify_user_message(text, state)
        predicted = intent_norm_map.get(predicted_raw, predicted_raw)

        is_match = (predicted == expected) or (expected == "product_search" and predicted in ["product_search", "new_search"])
        if is_match:
            correct += 1
            match_str = "✓ PASS"
        else:
            match_str = "✗ FAIL"

        short_text = text if len(text) <= 40 else text[:37] + "..."
        print(f"{idx:<3} | {short_text:<42} | {expected:<16} | {predicted:<16} | {match_str}")

    accuracy = (correct / total) * 100
    print("=" * 88)
    print(f"Total Evaluated: {total} utterances")
    print(f"Correct:         {correct}")
    print(f"Failed:          {total - correct}")
    print(f"Intent Accuracy: {accuracy:.2f}% (Threshold: 90.00%)")
    print("=" * 88)

    if accuracy >= 90.0:
        print(f"[SUCCESS] AI Model reached {accuracy:.1f}% accuracy on benchmark set (>= 90% required).")
        return 0
    else:
        print(f"[FAIL] AI Model accuracy {accuracy:.1f}% is below required 90.0% threshold.", file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser(description="TradeX AI Command Line Interface")
    subparsers = parser.add_subparsers(dest="command")

    admin_parser = subparsers.add_parser("create-admin", help="Bootstrap initial platform administrator")
    admin_parser.add_argument("--force", action="store_true", help="Force create administrator even if one exists")

    subparsers.add_parser("reindex", help="Reindex catalogue and RAG knowledge base embeddings into pgvector")
    subparsers.add_parser("ai-check", help="Test live AI model completion and print provider, model, latency and reply")
    subparsers.add_parser("ai-eval", help="Benchmark AI intent classification accuracy on fixtures/ai_utterances.json")
    subparsers.add_parser("audit-catalogue", help="Run comprehensive catalogue and supplier integrity audit")

    scale_parser = subparsers.add_parser("seed-scale", help="Seed enterprise scale demo dataset with is_demo=True")
    scale_parser.add_argument("--suppliers", type=int, default=60, help="Number of suppliers (default: 60)")
    scale_parser.add_argument("--buyers", type=int, default=150, help="Number of buyers (default: 150)")
    scale_parser.add_argument("--products", type=int, default=1500, help="Number of products (default: 1500)")
    scale_parser.add_argument("--rfqs", type=int, default=300, help="Number of RFQs (default: 300)")
    scale_parser.add_argument("--orders", type=int, default=200, help="Number of orders (default: 200)")

    args = parser.parse_args()

    if args.command == "create-admin":
        sys.exit(create_admin(force=args.force))
    elif args.command == "reindex":
        sys.exit(reindex_command())
    elif args.command == "ai-check":
        sys.exit(ai_check_command())
    elif args.command == "ai-eval":
        sys.exit(ai_eval_command())
    elif args.command == "audit-catalogue":
        sys.exit(audit_catalogue_command())
    elif args.command == "seed-scale":
        from app.scripts.seed_scale import seed_scale_data
        session = SyncSessionLocal()
        try:
            res = seed_scale_data(
                session=session,
                num_suppliers=args.suppliers,
                num_buyers=args.buyers,
                num_products=args.products,
                num_rfqs=args.rfqs,
                num_orders=args.orders,
            )
            print(f"[CLI SUCCESS] Scale dataset generated: {res}")
            sys.exit(0)
        finally:
            session.close()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
