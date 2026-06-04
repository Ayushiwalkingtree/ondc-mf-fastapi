from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.exceptions import AppException
from app.core.security import verify_internal_api_key
from app.db import get_db
from app.schemas.mf import SearchRequest, SelectRequest, InitRequest, ConfirmRequest, StatusRequest, OutboundResponse
from app.services.mf_mapper import MutualFundMapper
from app.services.ondc_client import OndcClient
from app.services.transaction_log import find_discovered_bpp, save_ondc_log

router = APIRouter(prefix='/mf', tags=['mutual-funds'], dependencies=[Depends(verify_internal_api_key)])
mapper = MutualFundMapper()
client = OndcClient()


async def _send(action: str, url: str, payload: dict, db: AsyncSession) -> OutboundResponse:
    await save_ondc_log(db, action=action, direction='outbound', payload=payload, status='SENT')
    ack = await client.post(url, payload)
    context = payload['context']
    return OutboundResponse(
        transaction_id=context['transaction_id'],
        message_id=context['message_id'],
        action=action,
        ack=ack,
    )


@router.post('/search', response_model=OutboundResponse)
async def search(req: SearchRequest, db: AsyncSession = Depends(get_db)) -> OutboundResponse:
    settings = get_settings()
    payload = mapper.build_search(req)
    return await _send('search', settings.ONDC_GATEWAY_SEARCH_URL, payload, db)


@router.post('/select', response_model=OutboundResponse)
async def select(req: SelectRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession = Depends(get_db)) -> OutboundResponse:
    bpp_uri, bpp_id = await _resolve_bpp(db, req.transaction_id, req.provider_id, bpp_uri, bpp_id)
    payload = mapper.build_select(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('select', bpp_uri.rstrip('/') + '/select', payload, db)


@router.post('/init', response_model=OutboundResponse)
async def init(req: InitRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession = Depends(get_db)) -> OutboundResponse:
    bpp_uri, bpp_id = await _resolve_bpp(db, req.transaction_id, req.provider_id, bpp_uri, bpp_id)
    payload = mapper.build_init(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('init', bpp_uri.rstrip('/') + '/init', payload, db)


@router.post('/confirm', response_model=OutboundResponse)
async def confirm(req: ConfirmRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession = Depends(get_db)) -> OutboundResponse:
    bpp_uri, bpp_id = await _resolve_bpp(db, req.transaction_id, req.provider_id, bpp_uri, bpp_id)
    payload = mapper.build_confirm(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('confirm', bpp_uri.rstrip('/') + '/confirm', payload, db)


@router.post('/status', response_model=OutboundResponse)
async def status(req: StatusRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession = Depends(get_db)) -> OutboundResponse:
    bpp_uri, bpp_id = await _resolve_bpp(db, req.transaction_id, None, bpp_uri, bpp_id)
    payload = mapper.build_status(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('status', bpp_uri.rstrip('/') + '/status', payload, db)


async def _resolve_bpp(
    db: AsyncSession,
    transaction_id: str,
    provider_id: str | None,
    bpp_uri: str | None,
    bpp_id: str | None,
) -> tuple[str, str | None]:
    if bpp_uri:
        return bpp_uri, bpp_id
    discovered = await find_discovered_bpp(db, transaction_id=transaction_id, provider_id=provider_id)
    if not discovered:
        raise AppException(
            'BPP URI not found for transaction. Wait for on_search or pass bpp_uri explicitly.',
            status_code=400,
            code='BPP_URI_NOT_FOUND',
        )
    discovered_uri, discovered_id = discovered
    return discovered_uri, bpp_id or discovered_id
