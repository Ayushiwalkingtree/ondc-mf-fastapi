from typing import Any
from pydantic import BaseModel, Field


class OndcCallbackPayload(BaseModel):
    context: dict[str, Any] = Field(default_factory=dict)
    message: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


class OnSubscribePayload(BaseModel):
    challenge: str | None = None
    subscriber_id: str | None = None
    unique_key_id: str | None = None
    encrypted_challenge: str | None = None
