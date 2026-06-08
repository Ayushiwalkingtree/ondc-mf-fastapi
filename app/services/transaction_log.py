from typing import Any
from decimal import Decimal
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.models.ondc import OndcTransactionLog


async def save_ondc_log(
    db: AsyncSession | None,
    *,
    action: str,
    direction: str,
    payload: dict[str, Any],
    status: str = 'RECEIVED',
    subscriber_id: str | None = None,
    error: str | None = None,
) -> OndcTransactionLog | None:
    settings = get_settings()
    if settings.NO_DATABASE or db is None:
        _print_ondc_log(action=action, direction=direction, payload=payload, status=status, subscriber_id=subscriber_id, error=error)
        return None
    if settings.DEBUG_PRINT_PAYLOADS:
        _print_ondc_log(action=action, direction=direction, payload=payload, status=status, subscriber_id=subscriber_id, error=error)

    context = payload.get('context') or {}
    transaction_id = context.get('transaction_id')
    message_id = context.get('message_id')
    metadata = _extract_log_metadata(action, payload)
    if transaction_id and message_id:
        existing = await db.scalar(
            select(OndcTransactionLog).where(
                OndcTransactionLog.action == action,
                OndcTransactionLog.direction == direction,
                OndcTransactionLog.transaction_id == transaction_id,
                OndcTransactionLog.message_id == message_id,
            )
        )
        if existing:
            return existing
    row = OndcTransactionLog(
        action=action,
        direction=direction,
        transaction_id=transaction_id,
        message_id=message_id,
        subscriber_id=subscriber_id,
        provider_id=metadata.get('provider_id'),
        item_id=metadata.get('item_id'),
        fulfillment_id=metadata.get('fulfillment_id'),
        bpp_id=metadata.get('bpp_id'),
        bpp_uri=metadata.get('bpp_uri'),
        status=status,
        payload=payload,
        raw_payload=payload,
        error=error,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def find_discovered_bpp(
    db: AsyncSession | None,
    *,
    transaction_id: str,
    provider_id: str | None = None,
) -> tuple[str, str | None] | None:
    settings = get_settings()
    if settings.NO_DATABASE or db is None:
        return None

    rows = (
        await db.scalars(
            select(OndcTransactionLog)
            .where(
                OndcTransactionLog.action == 'on_search',
                OndcTransactionLog.direction == 'inbound',
                OndcTransactionLog.transaction_id == transaction_id,
                OndcTransactionLog.status == 'ACK',
            )
            .order_by(OndcTransactionLog.created_at.desc())
        )
    ).all()
    for row in rows:
        match = _extract_bpp_from_on_search(row.payload, provider_id)
        if match:
            return match
    return None


async def find_discovered_select_details(
    db: AsyncSession | None,
    *,
    transaction_id: str,
    provider_id: str,
    item_id: str,
    scheme_item_id: str | None = None,
    fulfillment_id: str | None = None,
    fulfillment_type: str = 'LUMPSUM',
    amount: Decimal | None = None,
) -> dict[str, str] | None:
    settings = get_settings()
    if settings.NO_DATABASE or db is None:
        return None

    rows = (
        await db.scalars(
            select(OndcTransactionLog)
            .where(
                OndcTransactionLog.action == 'on_search',
                OndcTransactionLog.direction == 'inbound',
                OndcTransactionLog.transaction_id == transaction_id,
                OndcTransactionLog.status == 'ACK',
            )
            .order_by(OndcTransactionLog.created_at.desc())
        )
    ).all()
    for row in rows:
        match = _extract_select_details_from_on_search(
            row.payload,
            provider_id=provider_id,
            item_id=item_id,
            scheme_item_id=scheme_item_id,
            fulfillment_id=fulfillment_id,
            fulfillment_type=fulfillment_type,
        )
        if match:
            _validate_amount_thresholds(amount, match.get('thresholds') or {})
            return {key: str(value) for key, value in match.items() if key != 'thresholds' and value is not None}
    return None


def _print_ondc_log(
    *,
    action: str,
    direction: str,
    payload: dict[str, Any],
    status: str,
    subscriber_id: str | None,
    error: str | None,
) -> None:
    heading = 'ONDC CALLBACK' if direction == 'inbound' else 'ONDC OUTBOUND'
    print(f'=== {heading} ===')
    print(f'action: {action}')
    print(f'direction: {direction}')
    print(f'status: {status}')
    if subscriber_id:
        print(f'subscriber_id: {subscriber_id}')
    if error:
        print(f'error: {error}')
    print('payload:')
    print(json.dumps(payload, indent=2, sort_keys=True, default=str))
    print('============')


def _extract_log_metadata(action: str, payload: dict[str, Any]) -> dict[str, str | None]:
    context = payload.get('context') or {}
    message = payload.get('message') or {}
    order = message.get('order') if isinstance(message, dict) else None
    intent = message.get('intent') if isinstance(message, dict) else None
    catalog = message.get('catalog') if isinstance(message, dict) else None

    metadata: dict[str, str | None] = {
        'bpp_id': _to_str(context.get('bpp_id')),
        'bpp_uri': _to_str(context.get('bpp_uri')),
        'provider_id': None,
        'item_id': None,
        'fulfillment_id': None,
    }

    if isinstance(order, dict):
        provider = order.get('provider') or {}
        metadata['provider_id'] = _to_str(provider.get('id')) if isinstance(provider, dict) else None
        items = order.get('items') or []
        if items and isinstance(items[0], dict):
            metadata['item_id'] = _to_str(items[0].get('id'))
            fulfillment_ids = items[0].get('fulfillment_ids') or []
            if fulfillment_ids:
                metadata['fulfillment_id'] = _to_str(fulfillment_ids[0])
        fulfillments = order.get('fulfillments') or []
        if not metadata['fulfillment_id'] and fulfillments and isinstance(fulfillments[0], dict):
            metadata['fulfillment_id'] = _to_str(fulfillments[0].get('id'))
        return metadata

    if isinstance(intent, dict):
        provider = intent.get('provider') or {}
        metadata['provider_id'] = _to_str(provider.get('id')) if isinstance(provider, dict) else None
        return metadata

    if action == 'on_search' and isinstance(catalog, dict):
        providers = [item for item in catalog.get('providers') or [] if isinstance(item, dict)]
        if len(providers) == 1:
            provider = providers[0]
            metadata['provider_id'] = _to_str(provider.get('id'))
            plan_items = [
                item
                for item in provider.get('items') or []
                if isinstance(item, dict) and item.get('fulfillment_ids')
            ]
            if len(plan_items) == 1:
                metadata['item_id'] = _to_str(plan_items[0].get('id'))
                fulfillment_ids = plan_items[0].get('fulfillment_ids') or []
                if fulfillment_ids:
                    metadata['fulfillment_id'] = _to_str(fulfillment_ids[0])
        return metadata

    return metadata


def _to_str(value: Any) -> str | None:
    if value in (None, ''):
        return None
    return str(value)


def _extract_bpp_from_on_search(payload: dict[str, Any], provider_id: str | None) -> tuple[str, str | None] | None:
    context = payload.get('context') or {}
    bpp_uri = context.get('bpp_uri')
    bpp_id = context.get('bpp_id')
    if not bpp_uri:
        return None
    if not provider_id:
        return str(bpp_uri), str(bpp_id) if bpp_id else None
    catalog = (payload.get('message') or {}).get('catalog') or {}
    providers = catalog.get('providers') or []
    for provider in providers:
        if isinstance(provider, dict) and provider.get('id') == provider_id:
            return str(bpp_uri), str(bpp_id) if bpp_id else None
    return None


def _extract_select_details_from_on_search(
    payload: dict[str, Any],
    *,
    provider_id: str,
    item_id: str,
    scheme_item_id: str | None,
    fulfillment_id: str | None,
    fulfillment_type: str,
) -> dict[str, Any] | None:
    context = payload.get('context') or {}
    bpp_uri = context.get('bpp_uri')
    if not bpp_uri:
        return None

    catalog = (payload.get('message') or {}).get('catalog') or {}
    providers = catalog.get('providers') or []
    for provider in providers:
        if not isinstance(provider, dict) or provider.get('id') != provider_id:
            continue
        item = _find_catalog_item(provider, item_id=item_id, scheme_item_id=scheme_item_id)
        if not item:
            continue
        fulfillment = _find_catalog_fulfillment(
            provider,
            allowed_ids=item.get('fulfillment_ids') or [],
            fulfillment_id=fulfillment_id,
            fulfillment_type=fulfillment_type,
        )
        if not fulfillment:
            continue
        return {
            'bpp_uri': bpp_uri,
            'bpp_id': context.get('bpp_id'),
            'provider_id': provider_id,
            'item_id': item.get('id'),
            'scheme_item_id': item.get('parent_item_id'),
            'fulfillment_id': fulfillment.get('id'),
            'thresholds': _extract_thresholds(fulfillment),
        }
    return None


def _find_catalog_item(provider: dict[str, Any], *, item_id: str, scheme_item_id: str | None) -> dict[str, Any] | None:
    for item in provider.get('items') or []:
        if not isinstance(item, dict) or item.get('id') != item_id:
            continue
        if scheme_item_id and item.get('parent_item_id') != scheme_item_id:
            continue
        return item
    return None


def _find_catalog_fulfillment(
    provider: dict[str, Any],
    *,
    allowed_ids: list[Any],
    fulfillment_id: str | None,
    fulfillment_type: str,
) -> dict[str, Any] | None:
    allowed_id_values = {str(value) for value in allowed_ids}
    for fulfillment in provider.get('fulfillments') or []:
        if not isinstance(fulfillment, dict):
            continue
        candidate_id = str(fulfillment.get('id') or '')
        if candidate_id not in allowed_id_values:
            continue
        if fulfillment_id and candidate_id != fulfillment_id:
            continue
        if fulfillment.get('type') != fulfillment_type:
            continue
        return fulfillment
    return None


def _extract_thresholds(fulfillment: dict[str, Any]) -> dict[str, Decimal]:
    thresholds: dict[str, Decimal] = {}
    for tag in fulfillment.get('tags') or []:
        if not isinstance(tag, dict):
            continue
        descriptor = tag.get('descriptor') or {}
        if descriptor.get('code') != 'THRESHOLDS':
            continue
        for item in tag.get('list') or []:
            item_descriptor = item.get('descriptor') if isinstance(item, dict) else {}
            code = item_descriptor.get('code') if isinstance(item_descriptor, dict) else None
            value = item.get('value') if isinstance(item, dict) else None
            if code in {'AMOUNT_MIN', 'AMOUNT_MAX', 'AMOUNT_MULTIPLES'} and value not in (None, ''):
                thresholds[str(code)] = Decimal(str(value))
    return thresholds


def _validate_amount_thresholds(amount: Decimal | None, thresholds: dict[str, Decimal]) -> None:
    if amount is None or not thresholds:
        return
    minimum = thresholds.get('AMOUNT_MIN')
    maximum = thresholds.get('AMOUNT_MAX')
    multiple = thresholds.get('AMOUNT_MULTIPLES')
    if minimum is not None and amount < minimum:
        raise ValueError(f'amount must be at least {minimum}')
    if maximum is not None and amount > maximum:
        raise ValueError(f'amount must be at most {maximum}')
    if multiple and multiple > 0 and amount % multiple != 0:
        raise ValueError(f'amount must be in multiples of {multiple}')
