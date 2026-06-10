from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import get_settings


def test_on_update_callback_ack_and_persists(monkeypatch) -> None:
    monkeypatch.setenv('DEBUG', 'false')
    monkeypatch.setenv('NO_DATABASE', 'true')
    monkeypatch.setenv('ONDC_VERIFY_CALLBACK_SIGNATURES', 'false')
    get_settings.cache_clear()

    from app.api.v1 import callbacks

    saved: dict = {}

    async def fake_save_ondc_log(db, **kwargs):
        saved.update(kwargs)
        return None

    monkeypatch.setattr(callbacks, 'save_ondc_log', fake_save_ondc_log)

    app = FastAPI()
    app.include_router(callbacks.router)
    client = TestClient(app)

    payload = {
        'context': {
            'domain': 'ONDC:FIS14',
            'action': 'on_update',
            'transaction_id': 'txn-1',
            'message_id': 'msg-1',
            'bpp_id': 'staging-automation.ondc.org',
            'bpp_uri': 'https://workbench.ondc.tech/api-service/ONDC:FIS14/2.1.0/seller',
        },
        'message': {
            'order': {
                'id': 'mfpp_213adf123af',
                'status': 'COMPLETED',
                'fulfillments': [
                    {
                        'id': 'ff_122',
                        'type': 'LUMPSUM',
                        'state': {'descriptor': {'code': 'SUCCESSFUL'}},
                    }
                ],
                'payments': [
                    {
                        'id': 'pmt_123',
                        'status': 'PAID',
                    }
                ],
                'updated_at': '2026-06-10T10:00:00Z',
            }
        },
    }

    response = client.post('/ondc/on_update', json=payload)

    assert response.status_code == 200
    assert response.json() == {'message': {'ack': {'status': 'ACK'}}, 'error': None}
    assert saved['action'] == 'on_update'
    assert saved['direction'] == 'inbound'
    assert saved['status'] == 'ACK'
    assert saved['payload'] == payload


def test_main_app_mounts_on_update_callback(monkeypatch) -> None:
    monkeypatch.setenv('DEBUG', 'false')
    get_settings.cache_clear()

    from app.main import create_app

    app = create_app()

    assert any(
        getattr(route, 'path', None) == '/ondc/on_update'
        and 'POST' in getattr(route, 'methods', set())
        for route in app.routes
    )
