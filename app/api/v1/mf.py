from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from app.core.config import get_settings
from app.core.exceptions import AppException
from app.core.security import verify_internal_api_key
from app.db import get_db
from app.schemas.mf import SearchRequest, SelectRequest, InitRequest, ConfirmRequest, StatusRequest, OutboundResponse
from app.services.mf_mapper import MutualFundMapper
from app.services.ondc_client import OndcClient
from app.services.transaction_log import (
    find_discovered_bpp,
    find_discovered_select_details,
    find_transaction_message_sequence,
    save_ondc_log,
)

router = APIRouter(prefix='/mf', tags=['mutual-funds'], dependencies=[Depends(verify_internal_api_key)])
log = structlog.get_logger(__name__)
mapper = MutualFundMapper()
client = OndcClient()


async def _send(action: str, url: str, payload: dict, db: AsyncSession | None) -> OutboundResponse:
    await save_ondc_log(db, action=action, direction='outbound', payload=payload, status='SENT')
    context = payload['context']
    log.info(
        'outbound_http_send_context',
        action=action,
        **{
            'context.transaction_id': context.get('transaction_id'),
            'context.message_id': context.get('message_id'),
        },
    )
    ack = await client.post(url, payload)
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
    log.info(
        'SELECT_ENDPOINT_ENTERED',
        module_file=__file__,
        transaction_id=req.transaction_id,
        provider_id=req.provider_id,
        scheme_item_id=req.scheme_item_id,
        item_id=req.item_id,
        fulfillment_id=req.fulfillment_id,
        has_bpp_uri=bool(bpp_uri),
    )
    req, bpp_uri, bpp_id = await _resolve_select(req, db, bpp_uri, bpp_id)
    payload = mapper.build_select(req, bpp_id=bpp_id, bpp_uri=bpp_uri)
    pre_send_sequence = await find_transaction_message_sequence(db, transaction_id=req.transaction_id)
    raw_override_message_id = _raw_override_context_message_id(req.raw_overrides)
    log.info(
        'select_message_id_sequence',
        search_message_id=pre_send_sequence.get('search_message_id'),
        on_search_message_id=pre_send_sequence.get('on_search_message_id'),
        raw_override_context_message_id=raw_override_message_id,
        generated_select_message_id=payload['context'].get('message_id'),
    )
    log.info(
        'select_context_final_before_send',
        search_message_id=pre_send_sequence.get('search_message_id'),
        on_search_message_id=pre_send_sequence.get('on_search_message_id'),
        raw_override_context_message_id=raw_override_message_id,
        generated_select_message_id=payload['context'].get('message_id'),
        select_differs_from_search=(
            payload['context'].get('message_id') != pre_send_sequence.get('search_message_id')
        ),
        select_differs_from_on_search=(
            payload['context'].get('message_id') != pre_send_sequence.get('on_search_message_id')
        ),
        **{
            'context.transaction_id': payload['context'].get('transaction_id'),
            'context.message_id': payload['context'].get('message_id'),
        },
    )
    response = await _send('select', bpp_uri.rstrip('/') + '/select', payload, db)
    post_send_sequence = await find_transaction_message_sequence(db, transaction_id=req.transaction_id)
    sequence_values = [
        post_send_sequence.get('search_message_id'),
        post_send_sequence.get('on_search_message_id'),
        post_send_sequence.get('select_message_id'),
    ]
    present_sequence_values = [value for value in sequence_values if value]
    log.info(
        'select_db_message_id_verification',
        search_message_id=post_send_sequence.get('search_message_id'),
        on_search_message_id=post_send_sequence.get('on_search_message_id'),
        select_message_id=post_send_sequence.get('select_message_id'),
        all_different=(
            len(present_sequence_values) == 3
            and len(present_sequence_values) == len(set(present_sequence_values))
        ),
    )
    return response


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
    log.info(
        'RESOLVE_SELECT_ENTERED',
        module_file=__file__,
        transaction_id=req.transaction_id,
        provider_id=req.provider_id,
        scheme_item_id=req.scheme_item_id,
        item_id=req.item_id,
        fulfillment_id=req.fulfillment_id,
        has_bpp_uri=bool(bpp_uri),
    )
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
    log.info(
        'select_discovery_message_ids_resolved',
        on_search_message_id=discovered.get('source_message_id'),
        raw_override_context_message_id=_raw_override_context_message_id(req.raw_overrides),
    )
    resolved_req = req.model_copy(
        update={
            'fulfillment_id': req.fulfillment_id or discovered.get('fulfillment_id'),
            'scheme_item_id': req.scheme_item_id or discovered.get('scheme_item_id'),
            'raw_overrides': req.raw_overrides,
        }
    )
    return resolved_req, discovered['bpp_uri'], bpp_id or discovered.get('bpp_id')


def _ack_status(ack: dict) -> str:
    status = (((ack.get('message') or {}).get('ack') or {}).get('status') or '').upper()
    return status or 'RECEIVED'


def _raw_override_context_message_id(raw_overrides: dict) -> str | None:
    context = raw_overrides.get('context') or {}
    if not isinstance(context, dict):
        return None
    value = context.get('message_id')
    return str(value) if value is not None else None
