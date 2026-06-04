from typing import Any, Literal
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    intent: str = Field(default='mutual funds', description='Free text search intent')
    city: str | None = None
    provider_id: str | None = None
    category: str | None = None
    raw_overrides: dict[str, Any] = Field(default_factory=dict)


class SelectRequest(BaseModel):
    transaction_id: str
    provider_id: str
    item_id: str
    fulfillment_type: Literal['LUMPSUM', 'SIP'] = 'LUMPSUM'
    amount: float | None = None
    raw_overrides: dict[str, Any] = Field(default_factory=dict)


class InitRequest(BaseModel):
    transaction_id: str
    provider_id: str
    item_id: str
    investor: dict[str, Any]
    order: dict[str, Any]
    raw_overrides: dict[str, Any] = Field(default_factory=dict)


class ConfirmRequest(BaseModel):
    transaction_id: str
    provider_id: str
    order_id: str | None = None
    payment: dict[str, Any]
    raw_overrides: dict[str, Any] = Field(default_factory=dict)


class StatusRequest(BaseModel):
    transaction_id: str
    order_id: str
    raw_overrides: dict[str, Any] = Field(default_factory=dict)


class OutboundResponse(BaseModel):
    transaction_id: str
    message_id: str
    action: str
    ack: dict[str, Any]
