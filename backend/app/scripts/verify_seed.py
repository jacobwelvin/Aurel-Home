"""
Aurel Home — Catalogue Post-Seed Verification Utility
Inspects and reports all catalogue records, referential constraints, and indexes on PostgreSQL.
"""
import sys
from pathlib import Path
from sqlalchemy import text

BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.session import get_engine


def run_verification():
    engine = get_engine()

    with engine.connect() as conn:
        print("==================================================================")
        print("AUREL HOME — SUPABASE POSTGRESQL POST-SEED VERIFICATION")
        print("==================================================================")

        cat_count = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar()
        prod_count = conn.execute(text("SELECT COUNT(*) FROM products")).scalar()
        active_prod_count = conn.execute(text("SELECT COUNT(*) FROM products WHERE active = true")).scalar()
        print(f"\n1. TABLE RECORD COUNTS:")
        print(f"   - Categories in DB: {cat_count}")
        print(f"   - Total Products in DB: {prod_count}")
        print(f"   - Active Products in DB: {active_prod_count}")

        cat_dup = conn.execute(text("SELECT slug, COUNT(*) FROM categories GROUP BY slug HAVING COUNT(*) > 1")).fetchall()
        prod_dup = conn.execute(text("SELECT slug, COUNT(*) FROM products GROUP BY slug HAVING COUNT(*) > 1")).fetchall()
        print(f"\n2. DUPLICATE SLUG CHECKS:")
        print(f"   - Category duplicate slugs: {cat_dup if cat_dup else 'None (0 duplicates)'}")
        print(f"   - Product duplicate slugs: {prod_dup if prod_dup else 'None (0 duplicates)'}")

        orphaned_prods = conn.execute(text("""
            SELECT p.id, p.name, p.slug, p.category_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE c.id IS NULL
        """)).fetchall()
        print(f"\n3. REFERENTIAL INTEGRITY (CATEGORY ASSOCIATIONS):")
        print(f"   - Products with missing/invalid category_id: {len(orphaned_prods)}")

        cat_dist = conn.execute(text("""
            SELECT c.name, c.slug, c.realm_number, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id
            GROUP BY c.id, c.name, c.slug, c.realm_number
            ORDER BY c.realm_number
        """)).fetchall()
        print("   - Product count per category:")
        for row in cat_dist:
            print(f"     * [{row[2]}] {row[0]} ({row[1]}): {row[3]} products")

        invalid_prices = conn.execute(text("SELECT COUNT(*) FROM products WHERE price < 0")).scalar()
        invalid_stocks = conn.execute(text("SELECT COUNT(*) FROM products WHERE stock < 0")).scalar()
        price_stats = conn.execute(text("SELECT MIN(price), MAX(price), AVG(price) FROM products")).fetchone()
        print(f"\n4. FINANCIAL & INVENTORY INTEGRITY:")
        print(f"   - Products with price < 0: {invalid_prices}")
        print(f"   - Products with stock < 0: {invalid_stocks}")
        print(f"   - Price Range: Min = {price_stats[0]}, Max = {price_stats[1]}, Avg = {float(price_stats[2]):.2f}")

        featured_count = conn.execute(text("SELECT COUNT(*) FROM products WHERE featured = true")).scalar()
        bestseller_count = conn.execute(text("SELECT COUNT(*) FROM products WHERE bestseller = true")).scalar()
        print(f"\n5. EDITORIAL FLAGS PRESERVED:")
        print(f"   - Featured products count: {featured_count}")
        print(f"   - Bestseller products count: {bestseller_count}")

        empty_imgs = conn.execute(text("SELECT COUNT(*) FROM products WHERE json_array_length(images) = 0")).scalar()
        sample_images = conn.execute(text("SELECT slug, json_array_length(images) as img_count, images->>0 as first_img FROM products LIMIT 5")).fetchall()
        print(f"\n6. IMAGE REFERENCES VERIFICATION:")
        print(f"   - Products with empty image list: {empty_imgs}")
        print("   - Sample product images in DB:")
        for s in sample_images:
            print(f"     * {s[0]}: {s[1]} images (First: {s[2][:60]}...)")

        print("\n==================================================================")
        print("DATABASE POST-SEED VERIFICATION COMPLETE")
        print("==================================================================")


if __name__ == "__main__":
    run_verification()
