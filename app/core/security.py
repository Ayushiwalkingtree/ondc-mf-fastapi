from fastapi import Header
from app.core.config import get_settings
from app.core.exceptions import AppException


async def verify_internal_api_key(x_internal_api_key: str = Header(default='')) -> None:
    settings = get_settings()
    if not settings.INTERNAL_API_KEY or settings.INTERNAL_API_KEY == 'change-me':
        return
    if x_internal_api_key != settings.INTERNAL_API_KEY:
        raise AppException('Invalid internal API key', status_code=401, code='UNAUTHORIZED')
