from typing import Any
import json
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import get_settings
from app.core.exceptions import OndcClientError
from app.utils.json import dumps
from app.utils.ondc_auth import build_authorization_header_from_body

log = structlog.get_logger(__name__)


class OndcClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @retry(
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        raw_body = dumps(payload)
        headers = {
            'Content-Type': 'application/json',
            'Authorization': build_authorization_header_from_body(raw_body),
            'X-ONDC-Subscriber-Id': self.settings.ONDC_SUBSCRIBER_ID,
        }
        if self.settings.DEBUG_PRINT_PAYLOADS:
            print('=== ONDC OUTBOUND HTTP ===')
            print(f'url: {url}')
            print(f'action: {payload.get("context", {}).get("action")}')
            print('authorization:')
            print(headers['Authorization'])
            print('headers:')
            print(json.dumps(headers, indent=2, sort_keys=True))
            print('payload:')
            print(json.dumps(payload, indent=2, sort_keys=True, default=str))
            print('============')
        log.info('ondc_outbound_request', url=url, action=payload.get('context', {}).get('action'))
        try:
            async with httpx.AsyncClient(timeout=self.settings.ONDC_REQUEST_TIMEOUT_SECONDS) as client:
                resp = await client.post(url, content=raw_body, headers=headers)
                body_text = resp.text
                if resp.status_code >= 400:
                    log.error('ondc_outbound_error', status_code=resp.status_code, body=body_text[:1000])
                    raise OndcClientError(f'ONDC endpoint returned HTTP {resp.status_code}: {body_text[:1000]}', 502)
                try:
                    return resp.json()
                except ValueError:
                    return {'raw': body_text, 'status_code': resp.status_code}
        except httpx.TimeoutException as exc:
            raise OndcClientError('ONDC request timed out', 504) from exc
        except httpx.HTTPError as exc:
            raise OndcClientError(f'ONDC HTTP error: {exc}', 502) from exc
