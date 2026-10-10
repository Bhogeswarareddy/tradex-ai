from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="healthy", description="Application health status")
    version: str = Field(default="0.1.0", description="Application version")
    environment: str = Field(..., description="Active environment name")
    database: Optional[str] = Field(default="connected", description="Database connection state")
    ai_provider: str = Field(..., description="Active AI provider")
