from typing import Any
from pydantic import BaseModel, Field


class AckResponse(BaseModel):
    message: dict[str, dict[str, str]] = Field(default_factory=lambda: {'ack': {'status': 'ACK'}})
    error: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    error: dict[str, Any]
