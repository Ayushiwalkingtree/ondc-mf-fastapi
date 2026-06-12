from __future__ import annotations

from typing import Any, Literal
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.ondc import MfSearchRequestState

SearchStateStatus = Literal['initiated', 'waiting_for_webhook', 'completed', 'failed']

_memory_search_states: dict[str, dict[str, Any]] = {}


async def create_search_state(
    db: AsyncSession | None,
    *,
    request_payload: dict[str, Any],
    transaction_id: str | None = None,
    message_id: str | None = None,
    session_id: str | None = None,
    subscriber_url: str | None = None,
) -> str:
    tracking_id = str(uuid.uuid4())
    settings = get_settings()
    if settings.NO_DATABASE or db is None:
        _memory_search_states[tracking_id] = {
            'tracking_id': tracking_id,
            'transaction_id': transaction_id,
            'message_id': message_id,
            'status': 'initiated',
            'request_payload': request_payload,
            'catalogue': None,
            'session_id': session_id,
            'subscriber_url': subscriber_url,
            'error': None,
        }
        return tracking_id

    row = MfSearchRequestState(
        tracking_id=uuid.UUID(tracking_id),
        transaction_id=transaction_id,
        message_id=message_id,
        status='initiated',
        request_payload=request_payload,
        session_id=session_id,
        subscriber_url=subscriber_url,
    )
    db.add(row)
    await db.commit()
    return tracking_id


async def mark_search_waiting(
    db: AsyncSession | None,
    *,
    tracking_id: str,
    transaction_id: str,
    message_id: str,
) -> None:
    await _update_search_state(
        db,
        tracking_id=tracking_id,
        status='waiting_for_webhook',
        transaction_id=transaction_id,
        message_id=message_id,
        error=None,
    )


async def mark_search_failed(
    db: AsyncSession | None,
    *,
    tracking_id: str,
    error: str,
    transaction_id: str | None = None,
    message_id: str | None = None,
) -> None:
    await _update_search_state(
        db,
        tracking_id=tracking_id,
        status='failed',
        transaction_id=transaction_id,
        message_id=message_id,
        error=error,
    )


async def complete_search_by_transaction(
    db: AsyncSession | None,
    *,
    transaction_id: str | None,
    catalogue: dict[str, Any],
) -> None:
    if not transaction_id:
        return

    settings = get_settings()
    if settings.NO_DATABASE or db is None:
        matching = [
            state
            for state in _memory_search_states.values()
            if state.get('transaction_id') == transaction_id
            and state.get('status') in {'initiated', 'waiting_for_webhook'}
        ]
        for state in matching:
            state['status'] = 'completed'
            state['catalogue'] = catalogue
            state['error'] = None
        return

    rows = (
        await db.scalars(
            select(MfSearchRequestState)
            .where(
                MfSearchRequestState.transaction_id == transaction_id,
                MfSearchRequestState.status.in_(['initiated', 'waiting_for_webhook']),
            )
            .order_by(MfSearchRequestState.created_at.desc())
        )
    ).all()
    for row in rows:
        row.status = 'completed'
        row.catalogue = catalogue
        row.error = None
    if rows:
        await db.commit()


async def get_search_state(
    db: AsyncSession | None,
    *,
    tracking_id: str,
) -> dict[str, Any] | None:
    settings = get_settings()
    if settings.NO_DATABASE or db is None:
        return _memory_search_states.get(tracking_id)

    try:
        tracking_uuid = uuid.UUID(tracking_id)
    except ValueError:
        return None

    row = await db.get(MfSearchRequestState, tracking_uuid)
    if not row:
        return None
    return {
        'tracking_id': str(row.tracking_id),
        'transaction_id': row.transaction_id,
        'message_id': row.message_id,
        'status': row.status,
        'request_payload': row.request_payload,
        'catalogue': row.catalogue,
        'session_id': row.session_id,
        'subscriber_url': row.subscriber_url,
        'error': row.error,
    }


async def find_latest_active_search_session(
    db: AsyncSession | None,
) -> tuple[str | None, str | None]:
    settings = get_settings()
    active_statuses = {'initiated', 'waiting_for_webhook'}
    if settings.NO_DATABASE or db is None:
        active = [
            state
            for state in _memory_search_states.values()
            if state.get('session_id') and state.get('status') in active_statuses
        ]
        active.sort(key=lambda state: str(state.get('tracking_id')), reverse=True)
        if not active:
            return None, None
        return active[0].get('session_id'), active[0].get('subscriber_url')

    row = await db.scalar(
        select(MfSearchRequestState)
        .where(
            MfSearchRequestState.session_id.is_not(None),
            MfSearchRequestState.status.in_(list(active_statuses)),
        )
        .order_by(MfSearchRequestState.created_at.desc())
        .limit(1)
    )
    if not row:
        return None, None
    return row.session_id, row.subscriber_url


async def _update_search_state(
    db: AsyncSession | None,
    *,
    tracking_id: str,
    status: SearchStateStatus,
    transaction_id: str | None = None,
    message_id: str | None = None,
    error: str | None = None,
) -> None:
    settings = get_settings()
    if settings.NO_DATABASE or db is None:
        state = _memory_search_states.get(tracking_id)
        if not state:
            return
        if status == 'waiting_for_webhook' and state.get('status') == 'completed':
            return
        state['status'] = status
        if transaction_id is not None:
            state['transaction_id'] = transaction_id
        if message_id is not None:
            state['message_id'] = message_id
        state['error'] = error
        return

    try:
        tracking_uuid = uuid.UUID(tracking_id)
    except ValueError:
        return

    row = await db.get(MfSearchRequestState, tracking_uuid)
    if not row:
        return
    if status == 'waiting_for_webhook' and row.status == 'completed':
        return
    row.status = status
    if transaction_id is not None:
        row.transaction_id = transaction_id
    if message_id is not None:
        row.message_id = message_id
    row.error = error
    await db.commit()
