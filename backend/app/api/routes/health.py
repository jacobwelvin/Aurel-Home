from fastapi import APIRouter, status
from app.core.config import get_settings
from app.db.session import check_db_connectivity
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application and Database Health Check",
    description="Returns API status and tests connectivity to the database if configured.",
)
def get_health() -> HealthResponse:
    settings = get_settings()
    db_status = check_db_connectivity()

    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database=db_status,
    )
