from __future__ import annotations

from collections import defaultdict
from typing import Any
from fastapi import WebSocket
import structlog

log = structlog.get_logger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, transaction_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[transaction_id].add(websocket)
        log.info(
            'websocket_connected',
            transaction_id=transaction_id,
            active_connections=len(self._connections[transaction_id]),
        )

    def disconnect(self, transaction_id: str, websocket: WebSocket) -> None:
        connections = self._connections.get(transaction_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(transaction_id, None)
        log.info(
            'websocket_disconnected',
            transaction_id=transaction_id,
            active_connections=len(self._connections.get(transaction_id, set())),
        )

    async def send_event(self, transaction_id: str | None, payload: dict[str, Any]) -> None:
        if not transaction_id:
            return
        connections = list(self._connections.get(transaction_id, set()))
        if not connections:
            log.info('websocket_no_active_subscribers', transaction_id=transaction_id, event_name=payload.get('event'))
            return
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception as exc:
                stale.append(websocket)
                log.warning(
                    'websocket_send_failed',
                    transaction_id=transaction_id,
                    event_name=payload.get('event'),
                    error=str(exc),
                )
        for websocket in stale:
            self.disconnect(transaction_id, websocket)


connection_manager = ConnectionManager()
