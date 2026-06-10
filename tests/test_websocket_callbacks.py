from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import get_settings


def test_on_search_callback_pushes_websocket_event(monkeypatch) -> None:
    monkeypatch.setenv('DEBUG', 'false')
    monkeypatch.setenv('NO_DATABASE', 'true')
    monkeypatch.setenv('ONDC_VERIFY_CALLBACK_SIGNATURES', 'false')
    get_settings.cache_clear()

    from app.api.v1 import callbacks, websocket

    async def fake_save_ondc_log(db, **kwargs):
        return None

    monkeypatch.setattr(callbacks, 'save_ondc_log', fake_save_ondc_log)

    app = FastAPI()
    app.include_router(callbacks.router)
    app.include_router(websocket.router)
    client = TestClient(app)

    payload = {
        'context': {
            'domain': 'ONDC:FIS14',
            'action': 'on_search',
            'transaction_id': 'txn-search-1',
            'message_id': 'msg-on-search-1',
        },
        'message': {
            'catalog': {
                'providers': [
                    {
                        'id': 'provider-1',
                        'descriptor': {'name': 'Provider One'},
                        'items': [{'id': 'scheme-1', 'descriptor': {'name': 'Scheme One'}}],
                    }
                ]
            }
        },
    }

    with client.websocket_connect('/ws/ondc/txn-search-1') as ws:
        response = client.post('/ondc/on_search', json=payload)
        event = ws.receive_json()

    assert response.status_code == 200
    assert event['event'] == 'ON_SEARCH_RECEIVED'
    assert event['transaction_id'] == 'txn-search-1'
    assert event['payload'] == payload
