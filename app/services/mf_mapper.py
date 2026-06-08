from typing import Any
from urllib.parse import urlparse
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
        if req.fulfillment_type == 'LUMPSUM':
            fulfillment_id = _required(req.fulfillment_id, 'fulfillment_id')
            payload: dict[str, Any] = {
                'context': context,
                'message': {
                    'order': {
                        'provider': {'id': req.provider_id},
                        'items': [
                            {
                                'id': req.item_id,
                                'quantity': {
                                    'selected': {
                                        'measure': {
                                            'value': _decimal_to_string(req.amount),
                                            'unit': 'INR',
                                        }
                                    }
                                },
                                'fulfillment_ids': [fulfillment_id],
                            }
                        ],
                        'fulfillments': [
                            {
                                'id': fulfillment_id,
                                'type': 'LUMPSUM',
                                'customer': {'person': {'id': _person_id('pan', req.customer_pan)}},
                                'agent': _build_agent(req),
                            }
                        ],
                        **(_build_xinput(req) if req.form_submission_id else {}),
                        'tags': [_build_bap_terms_tag(req, context)],
                    }
                },
            }
            return deep_merge(payload, req.raw_overrides)

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


def _decimal_to_string(value: Any) -> str:
    if value is None:
        raise ValueError('amount is required')
    return format(value, 'f')


def _required(value: str | None, field_name: str) -> str:
    if not value:
        raise ValueError(f'{field_name} is required')
    return value


def _person_id(prefix: str, value: str | None) -> str:
    raw_value = _required(value, prefix)
    normalized_prefix = f'{prefix}:'
    raw_suffix = raw_value.split(':', 1)[1] if raw_value.lower().startswith(normalized_prefix) else raw_value
    if prefix == 'pan':
        raw_suffix = raw_suffix.lower()
    if prefix == 'euin':
        raw_suffix = raw_suffix.upper()
    return f'{normalized_prefix}{raw_suffix}'


def _build_agent(req: SelectRequest) -> dict[str, Any]:
    agent: dict[str, Any] = {
        'organization': {
            'creds': [
                {
                    'id': _required(req.arn, 'arn'),
                    'type': 'ARN',
                }
            ]
        }
    }
    if req.euin:
        agent['person'] = {'id': _person_id('euin', req.euin)}
    if req.sub_broker_arn:
        agent['organization']['creds'].append(
            {
                'id': req.sub_broker_arn,
                'type': 'SUB_BROKER_ARN',
            }
        )
    return agent


def _build_xinput(req: SelectRequest) -> dict[str, Any]:
    return {
        'xinput': {
            'form': {'id': _required(req.form_id, 'form_id')},
            'form_response': {'submission_id': req.form_submission_id},
        }
    }


def _build_bap_terms_tag(req: SelectRequest, context: dict[str, Any]) -> dict[str, Any]:
    return {
        'display': False,
        'descriptor': {'name': 'BAP Terms of Engagement', 'code': 'BAP_TERMS'},
        'list': [
            {
                'descriptor': {'name': 'Static Terms (Transaction Level)', 'code': 'STATIC_TERMS'},
                'value': req.bap_terms_url or _default_bap_terms_url(context),
            },
            {
                'descriptor': {'name': 'Offline Contract', 'code': 'OFFLINE_CONTRACT'},
                'value': str(req.offline_contract).lower(),
            },
        ],
    }


def _default_bap_terms_url(context: dict[str, Any]) -> str:
    settings = get_settings()
    parsed = urlparse(settings.ONDC_SUBSCRIBER_URI)
    base = f'{parsed.scheme}://{parsed.netloc}' if parsed.scheme and parsed.netloc else f'https://{settings.ONDC_SUBSCRIBER_ID}'
    domain = str(context.get('domain') or settings.ONDC_DOMAIN).lower()
    return f'{base}/legal/{domain}/static_terms?v=0.1'
