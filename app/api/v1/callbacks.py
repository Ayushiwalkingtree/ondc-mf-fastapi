from typing import Any
from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from app.core.config import get_settings
from app.db import get_db
from app.schemas.ondc import OndcCallbackPayload
from app.schemas.common import AckResponse
from app.services.registry import RegistryClient
from app.services.search_state import complete_search_by_transaction
from app.services.transaction_log import save_ondc_log
from app.services.websocket_manager import connection_manager
from app.utils.ondc_auth import AuthHeader, parse_authorization_header, verify_authorization_header

router = APIRouter(prefix='/ondc', tags=['ondc-callbacks'])
log = structlog.get_logger(__name__)
registry_client = RegistryClient()


async def _handle_callback(
    action: str,
    payload: OndcCallbackPayload,
    db: AsyncSession | None,
    authorization: str | None,
    raw_body: bytes,
) -> AckResponse:
    raw = payload.model_dump(exclude_none=True)
    _log_callback_entry(action, raw)
    if action == 'on_update':
        _log_on_update_shape(raw)
    settings = get_settings()
    if settings.DEBUG_PRINT_PAYLOADS:
        print('=== ONDC CALLBACK AUTHORIZATION ===')
        print(f'action: {action}')
        print(f'authorization: {authorization or ""}')
        print('============')
    try:
        auth = await _verify_callback_signature(raw, raw_body, authorization)
    except Exception as exc:
        await save_ondc_log(
            db,
            action=action,
            direction='inbound',
            payload=raw,
            status='NACK',
            error=str(exc),
        )
        log.warning('ondc_callback_rejected', action=action, error=str(exc))
        return _nack('ONDC_SIGNATURE_ERROR', str(exc))

    await save_ondc_log(
        db,
        action=action,
        direction='inbound',
        payload=raw,
        status='ACK',
        subscriber_id=auth.subscriber_id,
    )
    if action == 'on_search':
        await complete_search_by_transaction(
            db,
            transaction_id=raw.get('context', {}).get('transaction_id'),
            catalogue=raw,
        )
    await connection_manager.send_event(
        raw.get('context', {}).get('transaction_id'),
        {
            'event': _event_name(action),
            'transaction_id': raw.get('context', {}).get('transaction_id'),
            'payload': raw,
        },
    )
    log.info('ondc_callback_received', action=action, transaction_id=raw.get('context', {}).get('transaction_id'))
    return AckResponse()


@router.post('/on_search', response_model=AckResponse)
async def on_search(request: Request, payload: OndcCallbackPayload, db: AsyncSession | None = Depends(get_db), authorization: str | None = Header(default=None)) -> AckResponse:
    return await _handle_callback('on_search', payload, db, authorization, await request.body())


@router.post('/on_select', response_model=AckResponse)
async def on_select(request: Request, payload: OndcCallbackPayload, db: AsyncSession | None = Depends(get_db), authorization: str | None = Header(default=None)) -> AckResponse:
    raw_body = await request.body()
    log.info(
        'on_select_callback_entered',
        transaction_id=payload.context.get('transaction_id'),
        message_id=payload.context.get('message_id'),
        has_authorization=bool(authorization),
        raw_body_bytes=len(raw_body),
    )
    response = await _handle_callback('on_select', payload, db, authorization, raw_body)
    log.info(
        'on_select_callback_response',
        transaction_id=payload.context.get('transaction_id'),
        message_id=payload.context.get('message_id'),
        ack_status=((response.message or {}).get('ack') or {}).get('status'),
        has_error=response.error is not None,
    )
    return response


@router.post('/on_init', response_model=AckResponse)
async def on_init(request: Request, payload: OndcCallbackPayload, db: AsyncSession | None = Depends(get_db), authorization: str | None = Header(default=None)) -> AckResponse:
    return await _handle_callback('on_init', payload, db, authorization, await request.body())


@router.post('/on_confirm', response_model=AckResponse)
async def on_confirm(request: Request, payload: OndcCallbackPayload, db: AsyncSession | None = Depends(get_db), authorization: str | None = Header(default=None)) -> AckResponse:
    return await _handle_callback('on_confirm', payload, db, authorization, await request.body())


@router.post('/on_status', response_model=AckResponse)
async def on_status(request: Request, payload: OndcCallbackPayload, db: AsyncSession | None = Depends(get_db), authorization: str | None = Header(default=None)) -> AckResponse:
    return await _handle_callback('on_status', payload, db, authorization, await request.body())


@router.post('/on_update', response_model=AckResponse)
async def on_update(request: Request, payload: OndcCallbackPayload, db: AsyncSession | None = Depends(get_db), authorization: str | None = Header(default=None)) -> AckResponse:
    return await _handle_callback('on_update', payload, db, authorization, await request.body())


def _log_callback_entry(action: str, raw: dict[str, Any]) -> None:
    context = raw.get('context') or {}
    log.info(
        'ONDC CALLBACK',
        action=action,
        transaction_id=context.get('transaction_id'),
        message_id=context.get('message_id'),
    )


def _event_name(action: str) -> str:
    return {
        'on_search': 'ON_SEARCH_RECEIVED',
        'on_select': 'ON_SELECT_RECEIVED',
        'on_init': 'ON_INIT_RECEIVED',
        'on_confirm': 'ON_CONFIRM_RECEIVED',
        'on_status': 'ON_STATUS_RECEIVED',
        'on_update': 'ON_UPDATE_RECEIVED',
    }.get(action, f'{action.upper()}_RECEIVED')


def _log_on_update_shape(raw: dict[str, Any]) -> None:
    context = raw.get('context') or {}
    order = ((raw.get('message') or {}).get('order') or {})
    fulfillments = order.get('fulfillments') or []
    payments = order.get('payments') or []
    first_fulfillment = fulfillments[0] if fulfillments and isinstance(fulfillments[0], dict) else {}
    first_payment = payments[0] if payments and isinstance(payments[0], dict) else {}
    fulfillment_state = ((first_fulfillment.get('state') or {}).get('descriptor') or {}).get('code')
    payment_state = first_payment.get('status')
    checks = {
        'context.action': context.get('action') == 'on_update',
        'message.order.id': bool(order.get('id')),
        'message.order.status': bool(order.get('status')),
        'message.order.fulfillments[0].state.descriptor.code': bool(fulfillment_state),
        'message.order.payments[0].status': bool(payment_state),
        'message.order.updated_at': bool(order.get('updated_at')),
    }
    missing = [field for field, ok in checks.items() if not ok]
    log.info(
        'on_update_payload_schema_check',
        valid=not missing,
        missing_fields=missing,
        context_action=context.get('action'),
        order_id=order.get('id'),
        order_status=order.get('status'),
        fulfillment_state=fulfillment_state,
        payment_state=payment_state,
        updated_at=order.get('updated_at'),
    )


async def _verify_callback_signature(raw: dict[str, Any], raw_body: bytes, authorization: str | None) -> AuthHeader:
    settings = get_settings()
    if not settings.ONDC_VERIFY_CALLBACK_SIGNATURES:
        return AuthHeader(subscriber_id='verification-disabled', unique_key_id='', signature='', created='', expires='')
    if not authorization:
        raise ValueError('Missing Authorization header')
    auth = parse_authorization_header(authorization)
    public_key = await _resolve_signing_public_key(auth)
    verify_authorization_header(raw_body, authorization, public_key)
    return auth


async def _resolve_signing_public_key(auth: AuthHeader) -> str:
    settings = get_settings()
    if settings.ONDC_CALLBACK_SIGNING_PUBLIC_KEY_B64:
        return settings.ONDC_CALLBACK_SIGNING_PUBLIC_KEY_B64
    lookup = await registry_client.lookup_subscriber(auth.subscriber_id)
    public_key = _extract_signing_public_key(lookup, auth.unique_key_id)
    if not public_key:
        raise ValueError(f'Unable to resolve signing public key for {auth.subscriber_id}')
    return public_key


def _extract_signing_public_key(value: Any, unique_key_id: str) -> str | None:
    if isinstance(value, list):
        for item in value:
            found = _extract_signing_public_key(item, unique_key_id)
            if found:
                return found
    if isinstance(value, dict):
        key_pair = value.get('key_pair')
        if isinstance(key_pair, dict):
            key_id = value.get('unique_key_id') or key_pair.get('unique_key_id')
            public_key = key_pair.get('signing_public_key')
            if public_key and (not unique_key_id or not key_id or key_id == unique_key_id):
                return str(public_key)
        public_key = value.get('signing_public_key')
        key_id = value.get('unique_key_id')
        if public_key and (not unique_key_id or not key_id or key_id == unique_key_id):
            return str(public_key)
        for item in value.values():
            found = _extract_signing_public_key(item, unique_key_id)
            if found:
                return found
    return None


def _nack(code: str, message: str) -> AckResponse:
    return AckResponse(
        message={'ack': {'status': 'NACK'}},
        error={'type': 'AUTH-ERROR', 'code': code, 'message': message},
    )
