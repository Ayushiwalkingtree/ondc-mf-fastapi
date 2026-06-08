from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.exceptions import AppException
from app.core.security import verify_internal_api_key
from app.db import get_db
from app.schemas.mf import SearchRequest, SelectRequest, InitRequest, ConfirmRequest, StatusRequest, OutboundResponse
from app.services.mf_mapper import MutualFundMapper
from app.services.ondc_client import OndcClient
from app.services.transaction_log import find_discovered_bpp, find_discovered_select_details, save_ondc_log

router = APIRouter(prefix='/mf', tags=['mutual-funds'], dependencies=[Depends(verify_internal_api_key)])
mapper = MutualFundMapper()
client = OndcClient()


async def _send(action: str, url: str, payload: dict, db: AsyncSession | None) -> OutboundResponse:
    await save_ondc_log(db, action=action, direction='outbound', payload=payload, status='SENT')
    ack = await client.post(url, payload)
    context = payload['context']
    await save_ondc_log(
        db,
        action=action,
        direction='outbound_response',
        payload={'context': context, 'response': ack},
        status=_ack_status(ack),
    )
    return OutboundResponse(
        transaction_id=context['transaction_id'],
        message_id=context['message_id'],
        action=action,
        ack=ack,
    )


@router.post('/search', response_model=OutboundResponse)
async def search(req: SearchRequest, db: AsyncSession | None = Depends(get_db)) -> OutboundResponse:
    settings = get_settings()
    payload = mapper.build_search(req)
    return await _send('search', settings.ONDC_GATEWAY_SEARCH_URL, payload, db)


@router.post('/select', response_model=OutboundResponse)
async def select(req: SelectRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession | None = Depends(get_db)) -> OutboundResponse:
    req, bpp_uri, bpp_id = await _resolve_select(req, db, bpp_uri, bpp_id)
    payload = mapper.build_select(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('select', bpp_uri.rstrip('/') + '/select', payload, db)


@router.post('/init', response_model=OutboundResponse)
async def init(req: InitRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession | None = Depends(get_db)) -> OutboundResponse:
    bpp_uri, bpp_id = await _resolve_bpp(db, req.transaction_id, req.provider_id, bpp_uri, bpp_id)
    payload = mapper.build_init(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('init', bpp_uri.rstrip('/') + '/init', payload, db)


@router.post('/confirm', response_model=OutboundResponse)
async def confirm(req: ConfirmRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession | None = Depends(get_db)) -> OutboundResponse:
    bpp_uri, bpp_id = await _resolve_bpp(db, req.transaction_id, req.provider_id, bpp_uri, bpp_id)
    payload = mapper.build_confirm(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('confirm', bpp_uri.rstrip('/') + '/confirm', payload, db)


@router.post('/status', response_model=OutboundResponse)
async def status(req: StatusRequest, bpp_uri: str | None = None, bpp_id: str | None = None, db: AsyncSession | None = Depends(get_db)) -> OutboundResponse:
    bpp_uri, bpp_id = await _resolve_bpp(db, req.transaction_id, None, bpp_uri, bpp_id)
    payload = mapper.build_status(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    return await _send('status', bpp_uri.rstrip('/') + '/status', payload, db)


async def _resolve_bpp(
    db: AsyncSession | None,
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


async def _resolve_select(
    req: SelectRequest,
    db: AsyncSession | None,
    bpp_uri: str | None,
    bpp_id: str | None,
) -> tuple[SelectRequest, str, str | None]:
    if bpp_uri:
        if req.fulfillment_type == 'LUMPSUM' and not req.fulfillment_id:
            raise AppException(
                'fulfillment_id is required when bpp_uri is passed explicitly.',
                status_code=400,
                code='FULFILLMENT_ID_REQUIRED',
            )
        return req, bpp_uri, bpp_id
    try:
        discovered = await find_discovered_select_details(
            db,
            transaction_id=req.transaction_id,
            provider_id=req.provider_id,
            item_id=req.item_id,
            scheme_item_id=req.scheme_item_id,
            fulfillment_id=req.fulfillment_id,
            fulfillment_type=req.fulfillment_type,
            amount=req.amount,
        )
    except ValueError as exc:
        raise AppException(str(exc), status_code=400, code='SELECT_VALIDATION_FAILED') from exc
    if not discovered:
        raise AppException(
            'Matching on_search catalog entry not found for provider/item/fulfillment. Wait for on_search or pass bpp_uri explicitly.',
            status_code=400,
            code='SELECT_DISCOVERY_NOT_FOUND',
        )
    resolved_req = req.model_copy(
        update={
            'fulfillment_id': req.fulfillment_id or discovered.get('fulfillment_id'),
            'scheme_item_id': req.scheme_item_id or discovered.get('scheme_item_id'),
        }
    )
    return resolved_req, discovered['bpp_uri'], bpp_id or discovered.get('bpp_id')


def _ack_status(ack: dict) -> str:
    status = (((ack.get('message') or {}).get('ack') or {}).get('status') or '').upper()
    return status or 'RECEIVED'
