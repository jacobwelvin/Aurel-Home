# Aurel Home

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

A modern, high-craft e-commerce platform designed for an artisanal home décor and bespoke living atelier. Aurel Home pairs an editorial-grade Next.js storefront with a robust FastAPI backend, Supabase-backed PostgreSQL persistence, Razorpay payment verification, and automated commercial PDF tax invoice generation.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Order Placement Workflow](#order-placement-workflow)
- [Project Folder Structure](#project-folder-structure)
- [Installation and Setup](#installation-and-setup)
  - [Prerequisites](#prerequisites)
  - [Backend Setup (FastAPI)](#backend-setup-fastapi)
  - [Frontend Setup (Next.js)](#frontend-setup-nextjs)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Security Architecture](#security-architecture)
- [Screenshots](#screenshots)
- [Planned Enhancements](#planned-enhancements)
- [Author & License](#author--license)

---

## Project Overview

Aurel Home is an architectural, boutique e-commerce web application engineered with modern full-stack web standards. The platform serves two primary personas:

1. **Patrons (Customers):** Browse curations by design realm, inspect high-resolution product specs, maintain a persistent shopping cart and wishlist, authenticate via Supabase Auth, securely check out via Cash on Delivery (COD) or UPI / Razorpay test payments, track consignment order progress, and download official A4 tax invoices upon delivery.
2. **Atelier Curators (Administrators):** Manage the product catalogue, categorize collections, update stock and consignment inventory, inspect order fulfillment lifecycles, and update shipment statuses in real time.

The system is architected with strict separation of concerns: the Next.js client renders dynamic and responsive interfaces while communicating asynchronously with a FastAPI REST API that enforces authoritative server-side validation, transactional database consistency, and cryptographic signature verification.

---

## Key Features

### Storefront & Patron Experience
* **Editorial Storefront:** Curated home screen highlighting featured collections, atelier design narratives, patron testimonials, and social curations.
* **Catalogue Browsing & Search:** Filter furnishings, lighting, and décor by design realm, collection, in-stock availability, price, and sorting criteria.
* **Product Details:** Rich product display with image carousel, craftsmanship specifications, dimension details, stock status indicators, and direct add-to-bag interactions.
* **Persistent Bag & Wishlist:** Client-side state synchronization using Zustand with local storage persistence across sessions and browser refreshes.
* **Patron Authentication:** Seamless registration, sign-in, and session persistence powered by Supabase Auth with automatic backend profile synchronization.
* **Flexible Checkout Flow:** Real-time form validation with support for custom shipping addresses, delivery contact details, and dual settlement options:
  * **Cash on Delivery (COD):** Places the consignment immediately in an awaiting-payment state. Customers can later convert and settle their COD balance online via UPI.
  * **Online Payment (Razorpay Test Mode):** In-app Razorpay modal launch with exact server-calculated amount in INR paise, client-side callback handling, and server-side HMAC-SHA256 signature verification.
* **Consignment Tracking & History:** Responsive order history detailing consignment numbers, fulfillment timelines (Placed &rarr; Confirmed &rarr; Processing &rarr; Shipped &rarr; Delivered), settlement status, and shipping information.
* **Post-Delivery Tax Invoice:** Downloadable A4 PDF consignment tax invoice generated dynamically using ReportLab with Indian Rupee (`₹`) typography, compliant GST metadata, itemized pricing, and dual delivery/settlement cards.

### Atelier Administration
* **Management Overview:** Dashboard metrics summarizing total revenue, consignment count, patron volume, and inventory health.
* **Order Management:** Granular inspection of patron orders with status update workflows (`Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`).
* **Catalogue & Inventory Management:** Add, edit, or archive products and categories with image upload capabilities and slug uniqueness enforcement.
* **Access Control:** Role-Based Access Control (RBAC) ensuring only verified administrator accounts access atelier management endpoints.

---

## Technology Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router) | React Server Components, client hydration, and optimized routing |
| **UI Library** | [React 19](https://react.dev/) | Component architecture with React Hook Form and Lucide icons |
| **Language (Frontend)**| [TypeScript 5](https://www.typescriptlang.org/) | Strict static typing across components, APIs, and domain stores |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern utility-first CSS engine with bespoke atelier typography |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) | Lightweight, persistent client state for cart, wishlist, and auth |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12) | High-performance asynchronous REST API with automatic OpenAPI docs |
| **ORM & Migrations** | [SQLAlchemy 2.0](https://www.sqlalchemy.org/) & [Alembic](https://alembic.sqlalchemy.org/) | Declarative relational models and automated database migrations |
| **Database** | [PostgreSQL](https://www.postgresql.org/) (via [Supabase](https://supabase.com/)) | Managed relational database with connection pooling and RLS |
| **Authentication** | [Supabase Auth](https://supabase.com/auth) & [PyJWT](https://pyjwt.readthedocs.io/) | JWT bearer tokens with JWKS asymmetric and HS256 verification |
| **Payment Gateway** | [Razorpay](https://razorpay.com/) (Test Mode) | Server-authoritative order creation and HMAC-SHA256 signature verification |
| **PDF Generation** | [ReportLab](https://www.reportlab.com/) | Professional A4 two-page layout engine with custom font glyphs |
| **Validation** | [Pydantic v2](https://docs.pydantic.dev/) & [Zod](https://zod.dev/) | Strict runtime data validation on backend and frontend boundaries |

---

## System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer"]
        Patron["Patron (Customer)"]
        Admin["Administrator"]
        NextApp["Next.js Storefront & Admin App<br/>(React 19 / TypeScript / Zustand)"]
        Patron -->|Browse, Cart, Checkout| NextApp
        Admin -->|Catalogue & Order Management| NextApp
    end

    subgraph AuthLayer ["Authentication"]
        SupabaseAuth["Supabase Auth Service<br/>(OAuth / JWT Bearer Tokens)"]
        NextApp -->|Login / Signup| SupabaseAuth
        SupabaseAuth -->|JWT Token| NextApp
    end

    subgraph BackendLayer ["FastAPI Application (Port 8000)"]
        FastAPI["FastAPI REST Engine"]
        NextApp -->|REST Calls with Bearer Token| FastAPI

        AuthDeps["Auth Middleware & RBAC Guard<br/>(PyJWT & JWKS Validation)"]
        OrderSvc["Order & Settlement Service"]
        InvoiceSvc["ReportLab Invoice Generator"]
        ProductSvc["Product & Category Service"]

        FastAPI --> AuthDeps
        FastAPI --> OrderSvc
        FastAPI --> InvoiceSvc
        FastAPI --> ProductSvc
    end

    subgraph PaymentLayer ["Payment Infrastructure"]
        RazorpayAPI["Razorpay Payment Gateway<br/>(Test Mode)"]
        NextApp -->|Launch Checkout Modal| RazorpayAPI
        OrderSvc -->|Create Order / Verify HMAC Signature| RazorpayAPI
    end

    subgraph DataLayer ["Data & Persistence Layer"]
        PostgresDB[("Supabase PostgreSQL Database")]
        OrderSvc -->|Read / Write Consignments| PostgresDB
        ProductSvc -->|Catalogue CRUD| PostgresDB
        AuthDeps -->|Sync Patron Profile & Roles| PostgresDB
    end

    InvoiceSvc -->|Generate Streaming PDF| NextApp
```

---

## Order Placement Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Patron as Patron (Browser)
    participant Next as Next.js Storefront
    participant API as FastAPI Backend
    participant RZP as Razorpay API
    participant DB as PostgreSQL (Supabase)

    Patron->>Next: Submits Shipping Details & Selects Payment
    activate Next

    alt Online Payment (UPI / Razorpay)
        Next->>API: POST /api/v1/orders (Create Consignment)
        activate API
        API->>DB: Calculate server-authoritative totals & save Order (Status: Pending)
        DB-->>API: Saved Order Record
        API-->>Next: Order Created Response
        deactivate API

        Next->>API: POST /api/v1/orders/{id}/razorpay/create-order
        activate API
        API->>RZP: Request Order creation with exact amount in paise
        RZP-->>API: Razorpay Order ID & Key ID
        API-->>Next: Return { razorpay_order_id, key_id, amount }
        deactivate API

        Next->>RZP: Open Razorpay Test Modal & Complete Payment
        RZP-->>Next: Returns { razorpay_payment_id, razorpay_signature }

        Next->>API: POST /api/v1/orders/razorpay/verify
        activate API
        API->>API: Verify HMAC-SHA256 signature using RAZORPAY_KEY_SECRET
        API->>DB: Update Order (status: Confirmed, payment_status: Paid)
        DB-->>API: Updated Record
        API-->>Next: Verification Confirmation
        deactivate API

    else Cash on Delivery (COD)
        Next->>API: POST /api/v1/orders (payment_method: "cod")
        activate API
        API->>DB: Save Order (status: Confirmed, payment_status: Pending)
        DB-->>API: Confirmed Order Record
        API-->>Next: Return Confirmed Order Response
        deactivate API
    end

    Next-->>Patron: Display Order Confirmation & Consignment Code
    deactivate Next
```

---

## Project Folder Structure

```text
.
├── .env.example                     # Frontend environment configuration template
├── .gitignore                       # Root Git ignore rules (secrets, venv, caches)
├── AGENTS.md                        # Framework notes and agent development rules
├── package.json                     # Frontend dependencies and npm scripts
├── package-lock.json                # Locked Node.js dependency tree
├── tsconfig.json                    # TypeScript compiler configuration
├── next.config.ts                   # Next.js build and image optimization settings
├── postcss.config.mjs               # PostCSS styling configuration
├── eslint.config.mjs                # ESLint code style and quality rules
├── README.md                        # Project documentation
│
├── public/                          # Static public assets (SVGs, icons, logos)
│   ├── images/                      # Placeholder visual assets
│   └── *.svg                        # Interface vector icons
│
├── src/                             # Next.js application source tree
│   ├── app/                         # App Router routing structure
│   │   ├── account/                 # Patron profile and account security
│   │   ├── admin/                   # Atelier administration dashboard
│   │   │   ├── categories/          # Realm and category management
│   │   │   ├── inventory/           # Stock status overview
│   │   │   ├── orders/              # Consignment fulfillment control
│   │   │   ├── products/            # Product catalog management
│   │   │   └── page.tsx             # Admin metrics overview
│   │   ├── auth/                    # Supabase Auth callback and confirmation
│   │   ├── cart/                    # Shopping bag page
│   │   ├── checkout/                # Delivery and payment settlement flow
│   │   ├── login/                   # Patron login page
│   │   ├── orders/                  # Order tracking, timeline, and invoice download
│   │   ├── product/[slug]/          # Dynamic product detail page
│   │   ├── register/                # Patron account registration
│   │   ├── shop/                    # Catalogue filtering and browsing
│   │   ├── wishlist/                # Saved items showcase
│   │   ├── globals.css              # Global styles and Tailwind imports
│   │   ├── layout.tsx               # Root document layout with Navbar & Footer
│   │   └── page.tsx                 # Atelier storefront homepage
│   ├── components/                  # Modular React UI components
│   │   ├── admin/                   # Admin role guards and controls
│   │   ├── auth/                    # Auth modals, hash listeners, initializers
│   │   ├── cart/                    # Cart drawer and line item cards
│   │   ├── home/                    # Hero, CategoryShowcase, FeaturedProducts
│   │   ├── layout/                  # Navigation bar, Announcement bar, Footer
│   │   ├── product/                 # Product cards, image gallery, specs
│   │   └── ui/                      # Toasts, modals, search drawer
│   ├── data/                        # Static metadata and mock initializers
│   ├── lib/                         # Client utilities (Supabase, API client, helpers)
│   ├── store/                       # Zustand state stores (cart, wishlist, auth)
│   ├── types/                       # TypeScript interfaces and domain schemas
│   └── middleware.ts                # Next.js request edge middleware
│
└── backend/                         # FastAPI Python service
    ├── alembic/                     # Database migrations
    │   ├── versions/                # Ordered migration revisions
    │   └── env.py                   # Migration environment setup
    ├── app/                         # Application package
    │   ├── api/                     # REST routes and dependencies
    │   │   ├── routes/              # Modular route endpoints
    │   │   │   ├── admin.py         # Management endpoints
    │   │   │   ├── api.py           # v1 aggregated router
    │   │   │   ├── auth.py          # Session sync and role endpoints
    │   │   │   ├── categories.py    # Category catalog routes
    │   │   │   ├── health.py        # Health probe (`/health`)
    │   │   │   ├── orders.py        # Order placement, Razorpay, and invoice
    │   │   │   └── products.py      # Product catalog routes
    │   │   └── deps.py              # Security dependencies (JWT & Admin guards)
    │   ├── core/                    # Core configuration and Pydantic Settings
    │   │   └── config.py            # Environment variable bindings
    │   ├── db/                      # Database engine and session factory
    │   │   └── session.py           # SQLAlchemy session management
    │   ├── models/                  # SQLAlchemy ORM models
    │   │   ├── base.py              # Base model with timestamp mixins
    │   │   ├── cart.py              # Cart and CartItem models
    │   │   ├── category.py          # Category model
    │   │   ├── order.py             # Order, OrderItem, OrderHistory models
    │   │   ├── product.py           # Product catalog model
    │   │   └── user.py              # User model synchronized with Supabase
    │   ├── schemas/                 # Pydantic request and response schemas
    │   ├── scripts/                 # Utility scripts (catalogue seeding, admin promotion)
    │   │   ├── promote_admin.py     # CLI to designate administrator accounts
    │   │   ├── seed_catalogue.py    # Script to seed database from JSON fixtures
    │   │   └── verify_seed.py       # Seed data integrity check
    │   ├── services/                # Encapsulated business logic
    │   │   ├── auth_service.py      # Token decoding and user synchronization
    │   │   ├── category_service.py  # Category operations
    │   │   ├── invoice_service.py   # ReportLab PDF invoice generation
    │   │   ├── order_service.py     # Consignment management and totals
    │   │   ├── product_service.py   # Product catalogue CRUD
    │   │   └── razorpay_service.py  # Razorpay integration and HMAC verification
    │   └── main.py                  # FastAPI application entrypoint
    ├── static/                      # Uploaded product and atelier media
    ├── tests/                       # Pytest test suite (150+ automated tests)
    ├── alembic.ini                  # Alembic CLI configuration
    ├── data_categories.json         # Category seeding fixture
    ├── data_products.json           # Product catalogue fixture
    ├── requirements.txt             # Python dependency manifest
    ├── .env.example                 # Backend environment configuration template
    └── .gitignore                   # Backend-specific ignore rules
```

---

## Installation and Setup

### Prerequisites
* **Node.js:** v20.x or higher
* **Python:** v3.12 or higher
* **Git:** Installed on local path
* **Supabase Account:** Free project for PostgreSQL and Authentication
* **Razorpay Account:** Test Mode credentials (for payment testing)

---

### Backend Setup (FastAPI)

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment:**
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your Supabase database URI, JWT secret, and Razorpay test credentials (see [Environment Variables](#environment-variables)).

5. **Run database migrations:**
   ```bash
   alembic upgrade head
   ```

6. **Seed catalogue items (Optional):**
   ```bash
   python app/scripts/seed_catalogue.py
   ```

7. **Promote an administrator (Optional):**
   ```bash
   python app/scripts/promote_admin.py curator@aurelhome.com
   ```

---

### Frontend Setup (Next.js)

1. **Navigate to the project root:**
   ```bash
   cd ..
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` to point to your FastAPI backend and Supabase credentials.

---

## Environment Variables

All real secrets, private keys, and credentials must remain in local uncommitted files (`.env` and `.env.local`). Below are the required variables with placeholder formats.

### Frontend (`.env.local`)

```ini
# FastAPI Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase Auth & Public API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key-here

# Razorpay Test Mode Key (Safe for browser exposure)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_placeholder_key_id
```

### Backend (`backend/.env`)

```ini
# Environment
APP_ENV=development
APP_NAME="Aurel Home API"
DEBUG=true

# Database (Supabase PostgreSQL Connection URI)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require

# CORS Allowed Origins
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Admin API Key (For automation and backend scripts)
ADMIN_API_KEY=your-temporary-admin-secret-key-change-me

# Supabase Auth & Verification
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-supabase-jwt-secret-here
SUPABASE_ANON_KEY=your-supabase-anon-public-key-here

# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_placeholder_key_id
RAZORPAY_KEY_SECRET=your-razorpay-test-key-secret-here
RAZORPAY_WEBHOOK_SECRET=your-razorpay-test-webhook-secret-here
```

---

## Running the Application

For local development, both the FastAPI backend and Next.js frontend should be executed concurrently in separate terminal sessions.

### Terminal 1: Backend API
```bash
cd backend
# Ensure virtual environment is active
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
The backend will be available at `http://localhost:8000`.

### Terminal 2: Frontend Storefront
```bash
# From project root
npm run dev
```
The storefront will be accessible at `http://localhost:3000`.

---

## API Documentation

FastAPI automatically generates interactive OpenAPI documentation and schemas. Once the backend service is running, explore and test the endpoints directly:

* **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **OpenAPI Specification JSON:** [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)
* **Health Check Probe:** `GET http://localhost:8000/health`

---

## Security Architecture

1. **Authentication & Identity Isolation:**
   * Customer authentication is delegated to Supabase Auth.
   * Supabase JWT access tokens are validated server-side by FastAPI via asymmetric JWKS (`.well-known/jwks.json`) and fallback HMAC-SHA256 verification.
   * Patron records in `public.users` are automatically synchronized on first authenticated request.

2. **Role-Based Access Control (RBAC):**
   * Administrator operations (consignment management, catalogue updates, status transitions) require an authenticated patron record with `role == "admin"`.
   * Unauthenticated or non-admin requests receive immediate `401 Unauthorized` or `403 Forbidden` responses.

3. **Payment Integrity & Anti-Tampering:**
   * Order prices and totals are computed strictly from database records on the server; client-provided prices or totals are never trusted.
   * Orders are never marked as `Paid` based on client confirmation alone.
   * Razorpay payment callbacks must satisfy server-side HMAC-SHA256 signature verification matching the generated order ID and payment ID.

4. **Environment Isolation & Secrets Protection:**
   * Secret files (`.env`, `.env.local`, `backend/.env`) are strictly excluded via `.gitignore`.
   * Backend keys (`RAZORPAY_KEY_SECRET`, `ADMIN_API_KEY`, `DATABASE_URL`) are never prefixed with `NEXT_PUBLIC_` and never transmitted to the browser.
   * Database credentials utilize SSL encryption (`sslmode=require`).

---

## Screenshots

> *Placeholder: Add application screenshots to `public/images/screenshots/` and update references below before sharing.*

| Storefront Homepage | Product Catalogue & Details |
| :---: | :---: |
| ![Storefront Placeholder](public/images/placeholder.png) | ![Product Details Placeholder](public/images/placeholder.png) |

| Checkout & Payment Modal | Consignment Tracking & Invoice |
| :---: | :---: |
| ![Checkout Placeholder](public/images/placeholder.png) | ![Invoice Placeholder](public/images/placeholder.png) |

| Atelier Admin Overview | Consignment Management |
| :---: | :---: |
| ![Admin Dashboard Placeholder](public/images/placeholder.png) | ![Admin Orders Placeholder](public/images/placeholder.png) |

---

## Planned Enhancements

The following capabilities represent potential future roadmap items and are intentionally identified as planned improvements:

- [ ] **Multi-Currency Pricing:** Automatic localized currency selection and live exchange rate conversion for international patrons.
- [ ] **Automated Email Dispatch:** Transactional dispatch of order confirmation and PDF invoices via SendGrid or AWS SES.
- [ ] **Live Courier Tracking Webhooks:** Automated milestone synchronization with logistics partner APIs (e.g., Delhivery, Blue Dart).
- [ ] **Inventory Low-Stock Alerts:** Automated Slack/Email notifications to curators when product variant quantities breach safety thresholds.
- [ ] **Customer Review & Rating System:** Verified-patron product reviews with image uploads and curator moderation.

---

## Author & License

* **Crafted by:** [Jacob Welvin](https://github.com/jacobwelvin)
* **Project Repository:** [https://github.com/jacobwelvin/Aurel-Home](https://github.com/jacobwelvin/Aurel-Home)
* **License:** Refer to the repository LICENSE file for distribution terms.
