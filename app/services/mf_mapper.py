from typing import Any
from app.schemas.mf import SearchRequest, SelectRequest, InitRequest, ConfirmRequest, StatusRequest
from app.core.config import get_settings
from app.services.context import build_context


class MutualFundMapper:
    """Maps internal MF API requests to ONDC FIS payloads.

    The exact item/provider/quote/form fields must be aligned with the latest ONDC FIS Mutual Fund
    Swagger and Workbench examples for your selected draft/version before certification.
    """

    def build_search(self, req: SearchRequest) -> dict[str, Any]:
        context = build_context('search', city=req.city)
        settings = get_settings()
        category = {'descriptor': {'code': req.category or 'MUTUAL_FUNDS'}} if settings.ONDC_CORE_VERSION.startswith('2.') else None
        payload: dict[str, Any] = {
            'context': context,
            'message': {
                'intent': {
                    'descriptor': {'name': req.intent},
                    **({'provider': {'id': req.provider_id}} if req.provider_id else {}),
                    **({'category': category} if category else {}),
                    **({'category': {'id': req.category}} if req.category and not settings.ONDC_CORE_VERSION.startswith('2.') else {}),
                    **(
                        {
                            'fulfillment': {
                                'agent': {
                                    'organization': {
                                        'creds': [
                                            {
                                                'id': 'ARN-000000',
                                                'type': 'ARN',
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                        if settings.ONDC_CORE_VERSION.startswith('2.')
                        else {}
                    ),
                    **(
                        {
                            'tags': [
                                {
                                    'descriptor': {
                                        'code': 'BAP_TERMS',
                                    }
                                }
                            ]
                        }
                        if settings.ONDC_CORE_VERSION.startswith('2.')
                        else {}
                    ),
                }
            },
        }
        return deep_merge(payload, req.raw_overrides)

    def build_select(self, req: SelectRequest, bpp_id: str | None = None, bpp_uri: str | None = None) -> dict[str, Any]:
        context = build_context('select', transaction_id=req.transaction_id, bpp_id=bpp_id, bpp_uri=bpp_uri)
        payload: dict[str, Any] = {
            'context': context,
            'message': {
                'order': {
                    'provider': {'id': req.provider_id},
                    'items': [{'id': req.item_id}],
                    'fulfillments': [{'type': req.fulfillment_type}],
                    **({'quote': {'price': {'value': str(req.amount), 'currency': 'INR'}}} if req.amount else {}),
                }
            },
        }
        return deep_merge(payload, req.raw_overrides)

    def build_init(self, req: InitRequest, bpp_id: str | None = None, bpp_uri: str | None = None) -> dict[str, Any]:
        context = build_context('init', transaction_id=req.transaction_id, bpp_id=bpp_id, bpp_uri=bpp_uri)
        payload: dict[str, Any] = {
            'context': context,
            'message': {
                'order': {
                    'provider': {'id': req.provider_id},
                    'items': [{'id': req.item_id}],
                    'billing': req.investor,
                    **req.order,
                }
            },
        }
        return deep_merge(payload, req.raw_overrides)

    def build_confirm(self, req: ConfirmRequest, bpp_id: str | None = None, bpp_uri: str | None = None) -> dict[str, Any]:
        context = build_context('confirm', transaction_id=req.transaction_id, bpp_id=bpp_id, bpp_uri=bpp_uri)
        payload: dict[str, Any] = {
            'context': context,
            'message': {
                'order': {
                    **({'id': req.order_id} if req.order_id else {}),
                    'provider': {'id': req.provider_id},
                    'payments': [req.payment],
                }
            },
        }
        return deep_merge(payload, req.raw_overrides)

    def build_status(self, req: StatusRequest, bpp_id: str | None = None, bpp_uri: str | None = None) -> dict[str, Any]:
        context = build_context('status', transaction_id=req.transaction_id, bpp_id=bpp_id, bpp_uri=bpp_uri)
        payload: dict[str, Any] = {'context': context, 'message': {'order_id': req.order_id}}
        return deep_merge(payload, req.raw_overrides)


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result
