from typing import Any
from decimal import Decimal
import json
import structlog
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.models.ondc import OndcTransactionLog

log = structlog.get_logger(__name__)


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
                OndcTransactionLog.action.in_(['on_search', 'select', 'on_select', 'init', 'on_init']),
                OndcTransactionLog.transaction_id == transaction_id,
            )
            .order_by(OndcTransactionLog.created_at.desc())
        )
    ).all()
    for row in rows:
        match = _extract_bpp_from_payload(row.payload, provider_id)
        if match:
            return match
    return None


async def find_transaction_message_sequence(
    db: AsyncSession | None,
    *,
    transaction_id: str,
) -> dict[str, str | None]:
    settings = get_settings()
    sequence: dict[str, str | None] = {
        'search_message_id': None,
        'on_search_message_id': None,
        'select_message_id': None,
    }
    if settings.NO_DATABASE or db is None:
        return sequence

    rows = (
        await db.scalars(
            select(OndcTransactionLog)
            .where(OndcTransactionLog.transaction_id == transaction_id)
            .order_by(OndcTransactionLog.created_at.desc())
        )
    ).all()
    for row in rows:
        if row.action == 'search' and row.direction == 'outbound' and not sequence['search_message_id']:
            sequence['search_message_id'] = row.message_id
        elif row.action == 'on_search' and row.direction == 'inbound' and not sequence['on_search_message_id']:
            sequence['on_search_message_id'] = row.message_id
        elif row.action == 'select' and row.direction == 'outbound' and not sequence['select_message_id']:
            sequence['select_message_id'] = row.message_id
    return sequence


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
    criteria = {
        'transaction_id': transaction_id,
        'provider_id': provider_id,
        'scheme_item_id': scheme_item_id,
        'item_id': item_id,
        'fulfillment_id': fulfillment_id,
        'fulfillment_type': fulfillment_type,
        'amount': str(amount) if amount is not None else None,
    }
    log.info('DISCOVERY_LOOKUP_ENTERED', module_file=__file__, **criteria)
    settings = get_settings()
    log.info(
        'DISCOVERY_DATABASE_CONTEXT',
        DATABASE_BACKEND=_database_backend(settings.DATABASE_URL),
        DATABASE_URL=_safe_database_url(settings.DATABASE_URL),
        NO_DATABASE=settings.NO_DATABASE,
        has_db_session=db is not None,
        **criteria,
    )
    log.debug('select_discovery_lookup_start', **criteria)
    if settings.NO_DATABASE or db is None:
        log.info('select_discovery_lookup_skipped', reason='database_disabled', **criteria)
        return None

    all_rows = (
        await db.scalars(select(OndcTransactionLog).order_by(OndcTransactionLog.created_at.desc()))
    ).all()
    all_on_search_rows = [row for row in all_rows if row.action == 'on_search']
    total_rows_matching_transaction_id = sum(1 for row in all_rows if row.transaction_id == transaction_id)
    total_on_search_rows_matching_transaction_id = sum(1 for row in all_on_search_rows if row.transaction_id == transaction_id)
    log.info(
        'DISCOVERY_TABLE_COUNTS',
        total_transaction_log_rows=len(all_rows),
        total_on_search_rows=len(all_on_search_rows),
        total_rows_matching_transaction_id=total_rows_matching_transaction_id,
        total_on_search_rows_matching_transaction_id=total_on_search_rows_matching_transaction_id,
        total_rows_matching_provider_id=sum(1 for row in all_rows if row.provider_id == provider_id),
        total_on_search_rows_matching_provider_id_payload=sum(1 for row in all_on_search_rows if _payload_has_provider(row.payload, provider_id)),
        total_rows_matching_item_id=sum(1 for row in all_rows if row.item_id == item_id),
        total_on_search_rows_matching_item_id_payload=sum(1 for row in all_on_search_rows if _payload_has_item(row.payload, item_id)),
        total_rows_matching_fulfillment_id=sum(1 for row in all_rows if fulfillment_id and row.fulfillment_id == fulfillment_id),
        total_on_search_rows_matching_fulfillment_id_payload=sum(
            1 for row in all_on_search_rows if fulfillment_id and _payload_has_fulfillment(row.payload, fulfillment_id)
        ),
        **criteria,
    )
    if not all_on_search_rows:
        log.info('DISCOVERY_REJECTION_REASON', reason='no on_search rows found', **criteria)
    if total_rows_matching_transaction_id == 0:
        log.info(
            'DISCOVERY_REJECTION_REASON',
            reason='total_rows_matching_transaction_id = 0',
            likely_causes=[
                'select request is using a stale or wrong transaction_id',
                'search transaction_id was not persisted in this database',
                'server is connected to a different database/schema than the one inspected',
            ],
            available_recent_transaction_ids=_recent_transaction_ids(all_rows),
            **criteria,
        )
    elif total_on_search_rows_matching_transaction_id == 0:
        log.info(
            'DISCOVERY_REJECTION_REASON',
            reason='no on_search rows found for requested transaction_id',
            likely_causes=[
                'BPP callback has not reached /ondc/on_search',
                'on_search callback was stored with a different transaction_id',
                'select request is using the search ACK transaction_id but callback has not arrived yet',
            ],
            matching_non_on_search_actions=_actions_for_transaction(all_rows, transaction_id),
            available_on_search_transaction_ids=_recent_transaction_ids(all_on_search_rows),
            **criteria,
        )

    for row in all_on_search_rows:
        entries = _on_search_row_entries(row)
        for entry in entries:
            log.info(
                'DISCOVERY_ON_SEARCH_ROW',
                **_prefixed_log_fields(
                    criteria,
                    entry,
                    requested_transaction_id=transaction_id,
                    stored_transaction_id=row.transaction_id,
                ),
            )
        log.info(
            'DISCOVERY_ON_SEARCH_ROW_EVALUATION',
            row_id=str(row.id),
            requested_transaction_id=transaction_id,
            stored_transaction_id=row.transaction_id,
            rejection=_diagnose_on_search_row_rejection(
                row,
                provider_id=provider_id,
                item_id=item_id,
                scheme_item_id=scheme_item_id,
                fulfillment_id=fulfillment_id,
                fulfillment_type=fulfillment_type,
                transaction_id=transaction_id,
            ),
            **criteria,
        )

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
    log.info('select_discovery_candidates_found', matching_on_search_rows_count=len(rows), **criteria)
    for row in rows:
        summary = _summarize_on_search_candidate(row.payload)
        log.info(
            'select_discovery_candidate',
            row_id=str(row.id),
            row_message_id=row.message_id,
            row_created_at=str(row.created_at),
            row_provider_id=row.provider_id,
            row_item_id=row.item_id,
            row_fulfillment_id=row.fulfillment_id,
            row_bpp_id=row.bpp_id,
            row_bpp_uri=row.bpp_uri,
            candidate_summary=summary,
            **criteria,
        )
        match = _extract_select_details_from_on_search(
            row.payload,
            provider_id=provider_id,
            item_id=item_id,
            scheme_item_id=scheme_item_id,
            fulfillment_id=fulfillment_id,
            fulfillment_type=fulfillment_type,
        )
        if match:
            try:
                _validate_amount_thresholds(amount, match.get('thresholds') or {})
            except ValueError as exc:
                log.info(
                    'select_discovery_amount_rejected',
                    row_id=str(row.id),
                    reason=str(exc),
                    thresholds={key: str(value) for key, value in (match.get('thresholds') or {}).items()},
                    **criteria,
                )
                raise
            log.info(
                'select_discovery_match_found',
                row_id=str(row.id),
                source_message_id=row.message_id,
                bpp_id=match.get('bpp_id'),
                bpp_uri=match.get('bpp_uri'),
                resolved_provider_id=match.get('provider_id'),
                resolved_item_id=match.get('item_id'),
                resolved_scheme_item_id=match.get('scheme_item_id'),
                resolved_fulfillment_id=match.get('fulfillment_id'),
                **criteria,
            )
            match['source_message_id'] = row.message_id
            return {key: str(value) for key, value in match.items() if key != 'thresholds' and value is not None}
        log.info(
            'select_discovery_candidate_rejected',
            row_id=str(row.id),
            rejection=_diagnose_select_discovery_rejection(
                row.payload,
                provider_id=provider_id,
                item_id=item_id,
                scheme_item_id=scheme_item_id,
                fulfillment_id=fulfillment_id,
                fulfillment_type=fulfillment_type,
            ),
            **criteria,
        )
    log.info('select_discovery_no_match', reason='no_candidate_satisfied_all_conditions', **criteria)
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


def _prefixed_log_fields(
    criteria: dict[str, Any],
    entry: dict[str, Any],
    **extra: Any,
) -> dict[str, Any]:
    merged = dict(criteria)
    merged.update(extra)
    for key, value in entry.items():
        merged[f'entry_{key}'] = value
    return merged


def _recent_transaction_ids(rows: list[OndcTransactionLog], limit: int = 10) -> list[str | None]:
    seen: list[str | None] = []
    for row in rows:
        if row.transaction_id not in seen:
            seen.append(row.transaction_id)
        if len(seen) >= limit:
            break
    return seen


def _actions_for_transaction(rows: list[OndcTransactionLog], transaction_id: str) -> list[str]:
    return [f'{row.action}/{row.direction}/{row.status}' for row in rows if row.transaction_id == transaction_id]


def _database_backend(database_url: str) -> str:
    try:
        return make_url(database_url).get_backend_name()
    except Exception:
        return 'unknown'


def _safe_database_url(database_url: str) -> str:
    try:
        return make_url(database_url).render_as_string(hide_password=True)
    except Exception:
        return '<invalid DATABASE_URL>'


def _payload_has_provider(payload: dict[str, Any], provider_id: str) -> bool:
    return any(provider.get('id') == provider_id for provider in _payload_providers(payload))


def _payload_has_item(payload: dict[str, Any], item_id: str) -> bool:
    for provider in _payload_providers(payload):
        for item in provider.get('items') or []:
            if isinstance(item, dict) and item.get('id') == item_id:
                return True
    return False


def _payload_has_fulfillment(payload: dict[str, Any], fulfillment_id: str) -> bool:
    for provider in _payload_providers(payload):
        for fulfillment in provider.get('fulfillments') or []:
            if isinstance(fulfillment, dict) and fulfillment.get('id') == fulfillment_id:
                return True
    return False


def _payload_providers(payload: dict[str, Any]) -> list[dict[str, Any]]:
    catalog = (payload.get('message') or {}).get('catalog')
    if not isinstance(catalog, dict):
        return []
    providers = catalog.get('providers')
    if not isinstance(providers, list):
        return []
    return [provider for provider in providers if isinstance(provider, dict)]


def _on_search_row_entries(row: OndcTransactionLog) -> list[dict[str, Any]]:
    context = row.payload.get('context') or {}
    providers = _payload_providers(row.payload)
    if not providers:
        return [
            {
                'row_id': str(row.id),
                'transaction_id': row.transaction_id,
                'provider_id': row.provider_id,
                'item_id': row.item_id,
                'parent_item_id': None,
                'fulfillment_ids': None,
                'bpp_uri': row.bpp_uri or context.get('bpp_uri'),
                'action': row.action,
                'direction': row.direction,
                'status': row.status,
                'created_at': str(row.created_at),
                'malformed_payload': True,
            }
        ]

    entries: list[dict[str, Any]] = []
    for provider in providers:
        items = provider.get('items') or []
        if not isinstance(items, list) or not items:
            entries.append(
                {
                    'row_id': str(row.id),
                    'transaction_id': row.transaction_id,
                    'provider_id': provider.get('id'),
                    'item_id': None,
                    'parent_item_id': None,
                    'fulfillment_ids': None,
                    'bpp_uri': row.bpp_uri or context.get('bpp_uri'),
                    'action': row.action,
                    'direction': row.direction,
                    'status': row.status,
                    'created_at': str(row.created_at),
                    'malformed_payload': False,
                }
            )
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            entries.append(
                {
                    'row_id': str(row.id),
                    'transaction_id': row.transaction_id,
                    'provider_id': provider.get('id'),
                    'item_id': item.get('id'),
                    'parent_item_id': item.get('parent_item_id'),
                    'fulfillment_ids': item.get('fulfillment_ids'),
                    'bpp_uri': row.bpp_uri or context.get('bpp_uri'),
                    'action': row.action,
                    'direction': row.direction,
                    'status': row.status,
                    'created_at': str(row.created_at),
                    'malformed_payload': False,
                }
            )
    return entries


def _diagnose_on_search_row_rejection(
    row: OndcTransactionLog,
    *,
    provider_id: str,
    item_id: str,
    scheme_item_id: str | None,
    fulfillment_id: str | None,
    fulfillment_type: str,
    transaction_id: str,
) -> dict[str, Any]:
    if row.transaction_id != transaction_id:
        return {
            'failed_condition': 'transaction_id mismatch',
            'row_transaction_id': row.transaction_id,
            'expected_transaction_id': transaction_id,
        }
    if row.direction != 'inbound':
        return {'failed_condition': 'direction mismatch', 'row_direction': row.direction, 'expected_direction': 'inbound'}
    if row.status != 'ACK':
        return {'failed_condition': 'status mismatch', 'row_status': row.status, 'expected_status': 'ACK'}
    return _diagnose_select_discovery_rejection(
        row.payload,
        provider_id=provider_id,
        item_id=item_id,
        scheme_item_id=scheme_item_id,
        fulfillment_id=fulfillment_id,
        fulfillment_type=fulfillment_type,
    )


def _summarize_on_search_candidate(payload: dict[str, Any]) -> dict[str, Any]:
    context = payload.get('context') or {}
    catalog = (payload.get('message') or {}).get('catalog') or {}
    providers = catalog.get('providers') or []
    provider_summaries = []
    candidate_providers = providers if isinstance(providers, list) else []
    for provider in candidate_providers:
        if not isinstance(provider, dict):
            continue
        items = provider.get('items') or []
        fulfillments = provider.get('fulfillments') or []
        provider_summaries.append(
            {
                'provider_id': provider.get('id'),
                'items': [
                    {
                        'item_id': item.get('id'),
                        'parent_item_id': item.get('parent_item_id'),
                        'fulfillment_ids': item.get('fulfillment_ids'),
                    }
                    for item in items
                    if isinstance(item, dict)
                ],
                'fulfillments': [
                    {
                        'fulfillment_id': fulfillment.get('id'),
                        'type': fulfillment.get('type'),
                    }
                    for fulfillment in fulfillments
                    if isinstance(fulfillment, dict)
                ],
            }
        )
    return {
        'context_transaction_id': context.get('transaction_id'),
        'context_message_id': context.get('message_id'),
        'context_bpp_id': context.get('bpp_id'),
        'context_bpp_uri': context.get('bpp_uri'),
        'providers': provider_summaries,
    }


def _diagnose_select_discovery_rejection(
    payload: dict[str, Any],
    *,
    provider_id: str,
    item_id: str,
    scheme_item_id: str | None,
    fulfillment_id: str | None,
    fulfillment_type: str,
) -> dict[str, Any]:
    context = payload.get('context') or {}
    if not context.get('bpp_uri'):
        return {'failed_condition': 'context.bpp_uri', 'reason': 'missing bpp_uri'}

    catalog = (payload.get('message') or {}).get('catalog')
    if not isinstance(catalog, dict):
        return {'failed_condition': 'message.catalog', 'reason': 'missing catalog object'}

    providers = catalog.get('providers')
    if not isinstance(providers, list):
        return {'failed_condition': 'message.catalog.providers', 'reason': 'providers is missing or not a list'}

    provider = next((item for item in providers if isinstance(item, dict) and item.get('id') == provider_id), None)
    if not provider:
        return {
            'failed_condition': 'provider.id',
            'expected_provider_id': provider_id,
            'available_provider_ids': [item.get('id') for item in providers if isinstance(item, dict)],
        }

    items = provider.get('items') or []
    same_item_id = [item for item in items if isinstance(item, dict) and item.get('id') == item_id]
    if not same_item_id:
        return {
            'failed_condition': 'item.id',
            'expected_item_id': item_id,
            'available_items': [
                {
                    'item_id': item.get('id'),
                    'parent_item_id': item.get('parent_item_id'),
                    'fulfillment_ids': item.get('fulfillment_ids'),
                }
                for item in items
                if isinstance(item, dict)
            ],
        }

    item = next((candidate for candidate in same_item_id if not scheme_item_id or candidate.get('parent_item_id') == scheme_item_id), None)
    if not item:
        return {
            'failed_condition': 'item.parent_item_id',
            'expected_scheme_item_id': scheme_item_id,
            'candidate_items': [
                {
                    'item_id': candidate.get('id'),
                    'parent_item_id': candidate.get('parent_item_id'),
                    'fulfillment_ids': candidate.get('fulfillment_ids'),
                }
                for candidate in same_item_id
            ],
        }

    allowed_ids = {str(value) for value in item.get('fulfillment_ids') or []}
    fulfillments = [candidate for candidate in provider.get('fulfillments') or [] if isinstance(candidate, dict)]
    fulfillment = next(
        (
            candidate
            for candidate in fulfillments
            if str(candidate.get('id') or '') in allowed_ids
            and (not fulfillment_id or str(candidate.get('id') or '') == fulfillment_id)
            and candidate.get('type') == fulfillment_type
        ),
        None,
    )
    if not fulfillment:
        return {
            'failed_condition': 'fulfillment',
            'expected_fulfillment_id': fulfillment_id,
            'expected_fulfillment_type': fulfillment_type,
            'item_allowed_fulfillment_ids': sorted(allowed_ids),
            'available_fulfillments': [
                {
                    'fulfillment_id': candidate.get('id'),
                    'type': candidate.get('type'),
                    'is_allowed_by_item': str(candidate.get('id') or '') in allowed_ids,
                }
                for candidate in fulfillments
            ],
        }

    return {'failed_condition': None, 'reason': 'candidate appears to match but extractor returned no match'}


def _extract_bpp_from_on_search(payload: dict[str, Any], provider_id: str | None) -> tuple[str, str | None] | None:
    return _extract_bpp_from_payload(payload, provider_id)


def _extract_bpp_from_payload(payload: dict[str, Any], provider_id: str | None) -> tuple[str, str | None] | None:
    context = payload.get('context') or {}
    bpp_uri = context.get('bpp_uri')
    bpp_id = context.get('bpp_id')
    if not bpp_uri:
        return None
    if not provider_id:
        return str(bpp_uri), str(bpp_id) if bpp_id else None
    order = (payload.get('message') or {}).get('order') or {}
    provider = order.get('provider') if isinstance(order, dict) else None
    if isinstance(provider, dict) and provider.get('id') == provider_id:
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
