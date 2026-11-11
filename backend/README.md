# Aurel Home — Backend API Foundation

High-craft interior design atelier e-commerce API built with **Python 3.12**, **FastAPI**, **SQLAlchemy 2.0**, **Alembic**, and **Pydantic v2**, prepared for **Supabase PostgreSQL**.

---

## 1. Architecture Overview

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point, CORS & route mounting
│   ├── core/
│   │   ├── config.py        # Environment settings (Pydantic Settings)
│   ├── db/
│   │   ├── session.py       # SQLAlchemy engine, session generator & health ping
│   ├── models/              # SQLAlchemy database models
│   │   ├── base.py          # Declarative Base & TimestampMixin
│   │   ├── user.py          # User model (Supabase Auth compatible)
│   │   ├── category.py      # Design realms & categories
│   │   ├── product.py       # Catalog products with decimal pricing & constraints
│   │   ├── cart.py          # Cart and CartItem models
│   │   └── order.py         # Order and OrderItem models
│   ├── schemas/             # Pydantic request/response schemas
│   │   ├── health.py        # Health response schema
│   │   ├── category.py      # Category schemas
│   │   ├── product.py       # Product schemas (Decimal validation, pagination)
│   │   └── common.py        # Error schemas
│   ├── api/
│   │   ├── deps.py          # Security dependencies (Admin API key header guard)
│   │   └── routes/
│   │       ├── api.py       # Aggregated v1 API router
│   │       ├── health.py    # Health check endpoint (`GET /health`)
│   │       ├── categories.py# Category routes (`GET /api/v1/categories`)
│   │       └── products.py  # Product routes (`GET`, `POST`, `PATCH`, `DELETE`)
│   └── services/            # Encapsulated business logic
│       ├── category_service.py
│       └── product_service.py
├── alembic/                 # Database migration management
│   ├── env.py               # Alembic configuration with model metadata
│   ├── script.py.mako       # Migration template
│   └── versions/
│       └── 0001_initial_schema.py # Initial PostgreSQL-compatible migration
├── tests/                   # Automated test suite
│   ├── conftest.py          # In-memory test fixtures and client overrides
│   ├── test_health.py       # Health and root endpoint tests
│   ├── test_categories.py   # Category CRUD and slug uniqueness tests
│   ├── test_products.py     # Product CRUD, validation, and safe delete tests
│   └── test_models.py       # User, Cart, Order, and constraint tests
├── requirements.txt         # Production and development dependencies
├── alembic.ini              # Alembic migration configuration
├── .env.example             # Template environment configuration
├── .env                     # Local credentials (excluded from git)
└── README.md                # Documentation and setup instructions
```

---

## 2. Environment Setup

### Prerequisites
- Python 3.12+ installed
- PowerShell, bash, or terminal of choice

### Step 1: Create and activate virtual environment
From the `backend/` directory:
```bash
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### Step 2: Install dependencies
```bash
pip install -r requirements.txt
```

---

## 3. Environment Configuration

Copy `.env.example` to `.env` (or update existing `.env`):
```bash
cp .env.example .env
```

Default local `.env` variables:
```env
APP_ENV=development
APP_NAME="Aurel Home API"
DEBUG=true

# Replace with your Supabase PostgreSQL connection string when ready:
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require

# CORS allowed frontend origins
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Secret key required for write endpoints (POST, PATCH, DELETE)
ADMIN_API_KEY=aurel-home-admin-secret-dev
```

> **Security Note:** `.env` is ignored by Git in both root `.gitignore` and `backend/.gitignore`. Never commit credentials to version control.

---

## 4. Running the Development Server

From the `backend/` directory:
```bash
uvicorn app.main:app --reload --port 8000
```

Once running:
- **API Root**: [http://localhost:8000/](http://localhost:8000/)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 5. Running Automated Tests

All tests run against an **isolated in-memory SQLite database** using dependency overrides, so tests can run and pass immediately without requiring live Supabase credentials or risking any live data:

```bash
pytest tests -v
```

All 21 tests cover:
- Health check and DB connectivity reporting
- Category listing, retrieval, unique slug constraints, and write guards
- Product pagination, category filtering, search, and retrieval
- Validation rules (rejecting negative prices or stock)
- Product write protection (`401 Unauthorized` without `X-Admin-API-Key`)
- Product updates and safe deactivation (soft delete)
- User, Cart, Order, and OrderItem relationships and database integrity constraints

---

## 6. Supabase PostgreSQL Integration Guide

When you are ready to connect to your real Supabase PostgreSQL instance:

### Step 1: Obtain the Supabase PostgreSQL URI
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your Aurel Home project.
3. Navigate to **Project Settings** (gear icon) → **Database**.
4. Scroll to **Connection string** and select **URI**.
5. Copy the connection string. It will look like:
   ```
   postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
   ```
   *(Or direct port 5432: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require`)*

### Step 2: Configure `backend/.env`
Replace `DATABASE_URL` in `backend/.env` with your copied URI and actual database password:
```env
DATABASE_URL=postgresql://postgres.xxx:YOUR_REAL_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Step 3: Run Database Migrations
Once your `backend/.env` is configured with the live database connection, run Alembic migrations from the `backend/` directory:
```bash
alembic upgrade head
```
This will create all 7 tables (`users`, `categories`, `products`, `carts`, `cart_items`, `orders`, `order_items`) along with foreign keys, indexes, and check constraints on your Supabase database.

### Step 4: Verify Database Connectivity
Check [http://localhost:8000/health](http://localhost:8000/health). When connected to a live database, it will return:
```json
{
  "status": "ok",
  "app_name": "Aurel Home API",
  "environment": "development",
  "database": {
    "status": "connected",
    "connected": true,
    "message": "Database ping successful."
  }
}
```

---

## 7. Write Endpoint Protection

Until full customer / staff authentication and role-based access control (RBAC) are implemented in Phase 3, all write operations on products and categories (`POST`, `PATCH`, `DELETE`) require an administrative API key sent in the request header:

```http
X-Admin-API-Key: aurel-home-admin-secret-dev
```

Requests without this header or with an invalid key will be rejected with `401 Unauthorized`.

---

## 8. Catalogue Seeding & Verification

To populate or synchronize the connected PostgreSQL database with the complete Aurel Home atelier catalogue (6 categories and 21 products):

### Dry-Run Validation
```bash
python -m app.scripts.seed_catalogue --dry-run
```

### Live Seeding (Idempotent)
```bash
python -m app.scripts.seed_catalogue
```
* Categories are inserted first to preserve referential integrity.
* Stable, deterministic UUIDs (via RFC 4122 v5 based on unique slugs) ensure records maintain stable primary keys.
* Re-running the command safely updates existing records without creating duplicates.

### Post-Seed Verification
```bash
python -m app.scripts.verify_seed
```
This utility queries PostgreSQL directly and reports record counts, duplicate checks, orphaned products, price/stock bounds, and editorial flags.
