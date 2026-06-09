from decimal import Decimal
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from app.core.config import get_settings


class SearchRequest(BaseModel):
    intent: str = Field(default='mutual funds', description='Free text search intent')
    city: str | None = None
    provider_id: str | None = None
    category: str | None = None
    raw_overrides: dict[str, Any] = Field(default_factory=dict)


class SelectRequest(BaseModel):
    transaction_id: str | None = None
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
        if not get_settings().ENABLE_SELECT_NEW_TXN_ID and not self.transaction_id:
            raise ValueError('transaction_id is required unless ENABLE_SELECT_NEW_TXN_ID=true')
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
    fulfillment_id: str | None = None
    fulfillment_type: Literal['LUMPSUM', 'SIP'] = 'LUMPSUM'
    amount: Decimal | None = None
    customer_pan: str | None = None
    customer_ip: str | None = None
    customer_phone: str | None = None
    euin: str | None = None
    arn: str | None = None
    sub_broker_arn: str | None = None
    form_id: str | None = None
    form_submission_id: str | None = None
    quote_id: str | None = None
    payment_mode: str | None = None
    source_bank_code: str | None = None
    source_bank_account_number: str | None = None
    source_bank_account_name: str | None = None
    source_bank_account_type: str | None = None
    bap_terms_url: str | None = None
    offline_contract: bool = True
    investor: dict[str, Any] | None = None
    order: dict[str, Any] | None = None
    raw_overrides: dict[str, Any] = Field(default_factory=dict)

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError('amount must be greater than 0')
        return value

    @model_validator(mode='after')
    def validate_init(self) -> 'InitRequest':
        if self.order is not None:
            return self
        missing = [
            field
            for field in (
                'fulfillment_id',
                'amount',
                'customer_pan',
                'customer_ip',
                'customer_phone',
                'arn',
                'form_id',
                'form_submission_id',
                'payment_mode',
                'source_bank_code',
                'source_bank_account_number',
                'source_bank_account_name',
                'source_bank_account_type',
            )
            if getattr(self, field) in (None, '')
        ]
        if missing:
            raise ValueError(f'Init requires: {", ".join(missing)}')
        return self


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
