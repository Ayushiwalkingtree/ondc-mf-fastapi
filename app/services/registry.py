from typing import Any
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import uuid
from app.services.ondc_client import OndcClient
from app.core.config import get_settings


class RegistryClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OndcClient()

    def build_subscribe_payload(
        self,
        *,
        request_id: str | None = None,
        entity: dict[str, Any] | None = None,
        network_participant: dict[str, Any] | None = None,
        valid_from: datetime | None = None,
        valid_until: datetime | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        key_valid_from = valid_from or now
        key_valid_until = valid_until or now + timedelta(days=365)
        callback_url = self._on_subscribe_callback_url()
        participant_url = self._subscriber_url_path()
        entity_payload = {
            'subscriber_id': self.settings.ONDC_SUBSCRIBER_ID,
            'unique_key_id': self.settings.ONDC_UNIQUE_KEY_ID,
            'callback_url': callback_url,
            'key_pair': {
                'signing_public_key': self.settings.ONDC_SIGNING_PUBLIC_KEY_B64,
                'encryption_public_key': self.settings.ONDC_ENCRYPTION_PUBLIC_KEY_B64,
                'valid_from': _format_ts(key_valid_from),
                'valid_until': _format_ts(key_valid_until),
            },
        }
        entity_payload.update(entity or {})
        participant_payload = {
            'subscriber_url': participant_url,
            'domain': self.settings.ONDC_DOMAIN,
            'type': self.settings.ONDC_REGISTRY_SUBSCRIBER_TYPE,
            'msn': False,
            'city_code': [self.settings.ONDC_CITY],
        }
        participant_payload.update(network_participant or {})
        return {
            'context': {'operation': {'ops_no': 1}},
            'message': {
                'request_id': request_id or str(uuid.uuid4()),
                'timestamp': _format_ts(now),
                'entity': entity_payload,
                'network_participant': [participant_payload],
            },
        }

    async def subscribe(self, payload: dict[str, Any] | None = None, **kwargs: Any) -> dict[str, Any]:
        subscribe_payload = payload or self.build_subscribe_payload(**kwargs)
        url = self.settings.ONDC_SUBSCRIBE_URL or f'{self.settings.ONDC_REGISTRY_URL.rstrip("/")}/subscribe'
        return await self.client.post(url, subscribe_payload)

    async def lookup_subscriber(
        self,
        subscriber_id: str | None = None,
        domain: str | None = None,
        lookup_type: str | None = None,
        city: str | None = None,
    ) -> dict[str, Any]:
        payload = {
            'domain': domain or self.settings.ONDC_DOMAIN,
            'country': self.settings.ONDC_COUNTRY,
            'type': lookup_type or self.settings.ONDC_LOOKUP_TYPE,
        }
        if subscriber_id:
            payload['subscriber_id'] = subscriber_id
        if city:
            payload['city'] = city
        return await self.client.post(f'{self.settings.ONDC_REGISTRY_URL.rstrip("/")}/v2.0/lookup', payload)

    def _on_subscribe_callback_url(self) -> str:
        callback_url = self.settings.ONDC_CALLBACK_URL.strip() or '/ondc'
        if not callback_url.startswith('/'):
            callback_url = '/' + callback_url
        if callback_url.rstrip('/').endswith('/on_subscribe'):
            return callback_url.rstrip('/')
        return callback_url.rstrip('/') + '/on_subscribe'

    def _subscriber_url_path(self) -> str:
        parsed = urlparse(self.settings.ONDC_SUBSCRIBER_URI)
        path = parsed.path or self.settings.ONDC_CALLBACK_URL or '/ondc'
        return path if path.startswith('/') else '/' + path


def _format_ts(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
