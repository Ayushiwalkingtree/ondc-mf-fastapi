from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.ondc import OndcTransactionLog


async def save_ondc_log(
    db: AsyncSession,
    *,
    action: str,
    direction: str,
    payload: dict[str, Any],
    status: str = 'RECEIVED',
    subscriber_id: str | None = None,
    error: str | None = None,
) -> OndcTransactionLog:
    context = payload.get('context') or {}
    transaction_id = context.get('transaction_id')
    message_id = context.get('message_id')
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
        status=status,
        payload=payload,
        error=error,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def find_discovered_bpp(
    db: AsyncSession,
    *,
    transaction_id: str,
    provider_id: str | None = None,
) -> tuple[str, str | None] | None:
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
