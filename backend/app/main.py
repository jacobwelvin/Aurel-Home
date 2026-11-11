import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.api.routes.health import router as health_router
from app.api.routes.api import api_router

settings = get_settings()

# Ensure static upload directory exists
os.makedirs("static/uploads", exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    description="Aurel Home high-craft interior design atelier e-commerce API.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Mount static files for uploaded assets
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import time
import logging
from fastapi import Request

timing_logger = logging.getLogger("aurel.timing")


@app.middleware("http")
async def add_timing_and_metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{duration_ms:.2f}"

    path = request.url.path
    if path.startswith(("/api/v1/admin", "/api/v1/auth", "/health")):
        timing_logger.info(
            f"HTTP {request.method} {path} - {response.status_code} ({duration_ms:.2f}ms)"
        )
    return response

# Root health check endpoint
app.include_router(health_router)

# Versioned API routes under /api/v1
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to the {settings.APP_NAME}",
        "environment": settings.APP_ENV,
        "docs": "/docs",
        "health": "/health",
        "api_v1": settings.API_V1_PREFIX,
    }
