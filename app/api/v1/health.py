from fastapi import APIRouter
from redis.asyncio import Redis
from sqlalchemy import text
from app.core.config import get_settings
from app.db import engine

router = APIRouter(tags=['health'])


@router.get('/health/live')
async def live() -> dict[str, str]:
    return {'status': 'UP'}


@router.get('/health/ready')
async def ready() -> dict[str, str]:
    settings = get_settings()
    async with engine.connect() as conn:
        await conn.execute(text('SELECT 1'))
    if settings.REDIS_URL:
        redis = Redis.from_url(settings.REDIS_URL)
        try:
            await redis.ping()
        finally:
            await redis.aclose()
    return {'status': 'READY'}
