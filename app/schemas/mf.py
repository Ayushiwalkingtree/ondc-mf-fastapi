from decimal import Decimal
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


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
    scheme_item_id: str | None = None
    fulfillment_id: str | None = None
    fulfillment_type: Literal['LUMPSUM', 'SIP'] = 'LUMPSUM'
    amount: Decimal | None = None
    customer_pan: str | None = None
    euin: str | None = None
    arn: str | None = None
    sub_broker_arn: str | None = None
    bap_terms_url: str | None = None
    offline_contract: bool = True
    form_id: str | None = None
    form_submission_id: str | None = None
    raw_overrides: dict[str, Any] = Field(default_factory=dict)

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError('amount must be greater than 0')
        return value

    @model_validator(mode='after')
    def validate_lumpsum_select(self) -> 'SelectRequest':
        if self.fulfillment_type != 'LUMPSUM':
            return self
        missing = [
            field
            for field in ('amount', 'customer_pan', 'arn')
            if getattr(self, field) in (None, '')
        ]
        if missing:
            raise ValueError(f'LUMPSUM select requires: {", ".join(missing)}')
        if self.form_submission_id and not self.form_id:
            raise ValueError('form_id is required when form_submission_id is provided')
        return self


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
