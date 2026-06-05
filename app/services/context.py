import uuid
from datetime import datetime, timezone
from typing import Any
from app.core.config import get_settings


def build_context(action: str, transaction_id: str | None = None, city: str | None = None, bpp_id: str | None = None, bpp_uri: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    context = {
        'domain': settings.ONDC_DOMAIN,
        'action': action,
        'bap_id': settings.ONDC_SUBSCRIBER_ID,
        'bap_uri': settings.ONDC_SUBSCRIBER_URI,
        'transaction_id': transaction_id or str(uuid.uuid4()),
        'message_id': str(uuid.uuid4()),
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **({'bpp_id': bpp_id} if bpp_id else {}),
        **({'bpp_uri': bpp_uri} if bpp_uri else {}),
    }
    if settings.ONDC_CORE_VERSION.startswith('2.'):
        context.update(
            {
                'version': settings.ONDC_CORE_VERSION,
                'location': {
                    'country': {'code': settings.ONDC_COUNTRY},
                    'city': {'code': city or '*'},
                },
                'ttl': 'PT30S',
            }
        )
    else:
        context.update(
            {
                'country': settings.ONDC_COUNTRY,
                'city': city or settings.ONDC_CITY,
                'core_version': settings.ONDC_CORE_VERSION,
            }
        )
    return context
