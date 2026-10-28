"""
TradeX AI Catalogue Cleanup Script (Prompt 23 Part B)
Idempotently cleans junk drafts ('Product Row Item %', test duplicates) from the database.
Supports --dry-run mode.
"""
import argparse
import sys
from sqlalchemy import delete, func, or_, select
from app.core.db import SyncSessionLocal
from app.models.catalog import IndexJob, PriceTier, Product, ProductImage
from app.models.ai_mode import AISelectedProduct


def clean_catalogue(dry_run: bool = False) -> int:
    session = SyncSessionLocal()
    try:
        # Match junk drafts matching 'Product Row Item %' and test artifacts
        junk_filter = or_(
            Product.name.like("Product Row Item%"),
            Product.name.like("Upload Test Spice%"),
            Product.name.like("Test Product%"),
        )

        find_stmt = select(Product.id, Product.name, Product.status).where(junk_filter)
        junk_rows = session.execute(find_stmt).all()
        total_junk = len(junk_rows)

        print("================================================================================")
        print(" TradeX AI Catalogue Cleanup (Prompt 23)")
        print("================================================================================")
        print(f"Junk rows detected: {total_junk}")
        if total_junk > 0:
            print("Sample items to remove:")
            for row in junk_rows[:5]:
                print(f"  - [{row.id}] {row.name} ({row.status})")
            if total_junk > 5:
                print(f"  ... and {total_junk - 5} more.")

        if dry_run:
            print("\n[DRY RUN] No database records were modified or deleted.")
            return 0

        if total_junk == 0:
            print("\nDatabase is already clean. 0 junk items to remove.")
            return 0

        junk_ids = [row.id for row in junk_rows]
        junk_ids_str = [str(i) for i in junk_ids]

        # 1. Delete associated AI selected products
        del_ai_sel = delete(AISelectedProduct).where(AISelectedProduct.product_id.in_(junk_ids))
        session.execute(del_ai_sel)

        # 2. Delete index jobs (entity_id is string/varchar)
        del_idx = delete(IndexJob).where(IndexJob.entity_type == "product", IndexJob.entity_id.in_(junk_ids_str))
        session.execute(del_idx)

        # 3. Delete price tiers
        del_pt = delete(PriceTier).where(PriceTier.product_id.in_(junk_ids))
        session.execute(del_pt)

        # 4. Delete product images
        del_img = delete(ProductImage).where(ProductImage.product_id.in_(junk_ids))
        session.execute(del_img)

        # 5. Delete products
        del_prod = delete(Product).where(Product.id.in_(junk_ids))
        res = session.execute(del_prod)
        deleted_count = res.rowcount

        session.commit()

        remaining_count = session.execute(select(func.count(Product.id))).scalar()
        print(f"\nSuccessfully purged {deleted_count} junk products and their cascading references.")
        print(f"Clean product count remaining: {remaining_count}")
        print("================================================================================")
        return 0
    except Exception as exc:
        session.rollback()
        print(f"ERROR during catalogue cleanup: {exc}", file=sys.stderr)
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean junk product records from catalogue")
    parser.add_argument("--dry-run", action="store_true", help="Print items that would be purged without deleting")
    args = parser.parse_args()
    sys.exit(clean_catalogue(dry_run=args.dry_run))
