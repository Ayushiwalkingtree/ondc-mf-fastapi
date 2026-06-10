from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog
from app.services.websocket_manager import connection_manager

router = APIRouter(tags=['ondc-websocket'])
log = structlog.get_logger(__name__)


@router.websocket('/ws/ondc/{transaction_id}')
async def ondc_transaction_stream(websocket: WebSocket, transaction_id: str) -> None:
    await connection_manager.connect(transaction_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(transaction_id, websocket)
    except Exception as exc:
        log.warning('websocket_closed_with_error', transaction_id=transaction_id, error=str(exc))
        connection_manager.disconnect(transaction_id, websocket)
