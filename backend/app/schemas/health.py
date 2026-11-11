from datetime import datetime, timezone
from typing import Dict, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """
    Application health status and database connectivity response.
    """
    status: str = "ok"
    app_name: str
    environment: str
    database: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
