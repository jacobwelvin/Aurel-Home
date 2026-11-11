from typing import Optional, Any, Dict
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Standardized API error response format."""
    detail: str
    code: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
