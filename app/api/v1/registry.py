from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.config import get_settings
from app.schemas.ondc import OnSubscribePayload
from app.utils.crypto import decrypt_ondc_challenge

router = APIRouter(tags=['ondc-registry'])


@router.get('/ondc-site-verification.html', include_in_schema=False)
async def site_verification() -> FileResponse:
    settings = get_settings()
    path = Path(settings.ONDC_SITE_VERIFICATION_FILE)
    if not path.exists():
        raise HTTPException(status_code=404, detail='ondc-site-verification.html not found')
    return FileResponse(path, media_type='text/html')


@router.post('/ondc/on_subscribe')
async def on_subscribe(payload: OnSubscribePayload) -> dict[str, str]:
    settings = get_settings()
    encrypted = payload.challenge or payload.encrypted_challenge
    if not encrypted:
        return {'error': 'challenge is required'}

    answer = decrypt_ondc_challenge(
        encrypted,
        settings.ONDC_ENCRYPTION_PRIVATE_KEY_B64,
        settings.ONDC_REGISTRY_PUBLIC_KEY_B64,
    )
    return {'answer': answer}
