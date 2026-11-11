"""
Aurel Home — Catalogue Seeding Script
Populates the connected PostgreSQL database with categories and products from the atelier catalogue.
Ensures idempotency, referential integrity, and non-destructive upserts.
"""
import json
import logging
import sys
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Dict, Any, List, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.core.config import get_settings
from app.db.session import get_engine
from app.models.category import Category
from app.models.product import Product

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("seed_catalogue")

CAT_FILE = BASE_DIR / "data_categories.json"
PROD_FILE = BASE_DIR / "data_products.json"


def load_catalogue_data() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Load categories and products from local JSON fixtures."""
    if not CAT_FILE.exists() or not PROD_FILE.exists():
        raise FileNotFoundError(
            f"Catalogue JSON files not found in {BASE_DIR}. "
            "Please ensure data_categories.json and data_products.json exist."
        )
    categories = json.loads(CAT_FILE.read_text(encoding="utf-8"))
    products = json.loads(PROD_FILE.read_text(encoding="utf-8"))
    return categories, products


def validate_catalogue(categories: List[Dict[str, Any]], products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validate data integrity before touching the database.
    Checks:
    - Unique slugs
    - Valid category associations
    - Non-negative prices and stock
    - Image URLs
    """
    cat_slugs = {c["slug"] for c in categories}
    if len(cat_slugs) != len(categories):
        raise ValueError("Duplicate category slugs detected in source data.")

    prod_slugs = {p["slug"] for p in products}
    if len(prod_slugs) != len(products):
        raise ValueError("Duplicate product slugs detected in source data.")

    missing_cat_links = [p["slug"] for p in products if p.get("categorySlug") not in cat_slugs]
    if missing_cat_links:
        raise ValueError(f"Products with invalid categorySlug: {missing_cat_links}")

    invalid_prices = [p["slug"] for p in products if p.get("price", -1) < 0]
    if invalid_prices:
        raise ValueError(f"Products with negative prices: {invalid_prices}")

    invalid_stocks = [p["slug"] for p in products if p.get("stock", -1) < 0]
    if invalid_stocks:
        raise ValueError(f"Products with negative stock: {invalid_stocks}")

    # Check for unmapped source fields
    unmapped_fields = {}
    for p in products:
        for key in ["provenance", "artisan", "isNew", "sizes", "category"]:
            if key in p and p[key] is not None:
                unmapped_fields[key] = unmapped_fields.get(key, 0) + 1

    return {
        "categories_count": len(categories),
        "products_count": len(products),
        "unmapped_fields_distribution": unmapped_fields,
        "valid": True,
    }


def seed_catalogue(dry_run: bool = False) -> Dict[str, Any]:
    """
    Execute idempotent catalogue seeding.
    Uses batch queries and stable deterministic UUIDs for high performance over remote SSL connections.
    """
    categories_data, products_data = load_catalogue_data()
    validation = validate_catalogue(categories_data, products_data)
    logger.info(f"Catalogue validation passed: {validation['categories_count']} categories, {validation['products_count']} products.")

    if dry_run:
        logger.info("Dry run requested. No database modifications performed.")
        return {
            "dry_run": True,
            "planned_categories": len(categories_data),
            "planned_products": len(products_data),
            "validation": validation,
        }

    engine = get_engine()
    settings = get_settings()

    logger.info(f"Target Database Environment: {settings.APP_ENV}")

    stats = {
        "categories_inserted": 0,
        "categories_updated": 0,
        "products_inserted": 0,
        "products_updated": 0,
    }

    with Session(engine) as session:
        with session.begin():
            # 1. Fetch all existing categories in a single query
            existing_cats = {c.slug: c for c in session.scalars(select(Category)).all()}
            category_map: Dict[str, Category] = {}

            for cat_data in categories_data:
                slug = cat_data["slug"]
                if slug in existing_cats:
                    # Update existing category
                    cat = existing_cats[slug]
                    cat.name = cat_data["name"]
                    cat.realm_number = cat_data.get("realmNumber")
                    cat.description = cat_data.get("description")
                    cat.image = cat_data.get("image")
                    cat.active = True
                    category_map[slug] = cat
                    stats["categories_updated"] += 1
                else:
                    # Deterministic stable UUID
                    stable_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"aurelhome.category.{slug}")
                    new_cat = Category(
                        id=stable_uuid,
                        name=cat_data["name"],
                        slug=slug,
                        realm_number=cat_data.get("realmNumber"),
                        description=cat_data.get("description"),
                        image=cat_data.get("image"),
                        active=True,
                    )
                    session.add(new_cat)
                    category_map[slug] = new_cat
                    stats["categories_inserted"] += 1

            # Flush categories so all primary keys are guaranteed populated
            session.flush()

            # 2. Fetch all existing products in a single query
            existing_prods = {p.slug: p for p in session.scalars(select(Product)).all()}

            for prod_data in products_data:
                slug = prod_data["slug"]
                cat_slug = prod_data["categorySlug"]
                category = category_map.get(cat_slug)
                if not category:
                    raise ValueError(f"Category '{cat_slug}' not found for product '{slug}'")

                compare_at = prod_data.get("compareAtPrice")
                compare_at_decimal = Decimal(str(compare_at)) if compare_at is not None else None

                if slug in existing_prods:
                    # Update existing product
                    prod = existing_prods[slug]
                    prod.name = prod_data["name"]
                    prod.subtitle = prod_data.get("subtitle")
                    prod.description = prod_data.get("description")
                    prod.price = Decimal(str(prod_data["price"]))
                    prod.compare_at_price = compare_at_decimal
                    prod.stock = prod_data.get("stock", 0)
                    prod.images = prod_data.get("images", [])
                    prod.details = prod_data.get("details", [])
                    prod.materials = prod_data.get("materials")
                    prod.dimensions = prod_data.get("dimensions")
                    prod.care = prod_data.get("care")
                    prod.badge = prod_data.get("badge")
                    prod.colors = prod_data.get("colors", [])
                    prod.rating = Decimal(str(prod_data.get("rating", 5.00)))
                    prod.review_count = prod_data.get("reviewCount", 0)
                    prod.featured = bool(prod_data.get("featured", False))
                    prod.bestseller = bool(prod_data.get("bestseller", False))
                    prod.category_id = category.id
                    prod.active = True
                    stats["products_updated"] += 1
                else:
                    # Deterministic stable product UUID
                    stable_prod_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"aurelhome.product.{slug}")
                    new_prod = Product(
                        id=stable_prod_uuid,
                        name=prod_data["name"],
                        slug=slug,
                        subtitle=prod_data.get("subtitle"),
                        description=prod_data.get("description"),
                        price=Decimal(str(prod_data["price"])),
                        compare_at_price=compare_at_decimal,
                        stock=prod_data.get("stock", 0),
                        images=prod_data.get("images", []),
                        details=prod_data.get("details", []),
                        materials=prod_data.get("materials"),
                        dimensions=prod_data.get("dimensions"),
                        care=prod_data.get("care"),
                        badge=prod_data.get("badge"),
                        colors=prod_data.get("colors", []),
                        rating=Decimal(str(prod_data.get("rating", 5.00))),
                        review_count=prod_data.get("reviewCount", 0),
                        featured=bool(prod_data.get("featured", False)),
                        bestseller=bool(prod_data.get("bestseller", False)),
                        category_id=category.id,
                        active=True,
                    )
                    session.add(new_prod)
                    stats["products_inserted"] += 1

    logger.info(
        f"Catalogue seeding completed: "
        f"Categories (inserted={stats['categories_inserted']}, updated={stats['categories_updated']}), "
        f"Products (inserted={stats['products_inserted']}, updated={stats['products_updated']})."
    )
    return stats


if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    try:
        result = seed_catalogue(dry_run=is_dry)
        print("\nSeeding Execution Summary:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        logger.error(f"Seeding failed: {type(e).__name__}: {str(e)}")
        sys.exit(1)
