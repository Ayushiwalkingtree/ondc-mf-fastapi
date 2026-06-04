from contextlib import asynccontextmanager
from typing import AsyncGenerator
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import structlog
import uuid

from app.api.v1 import health, registry, callbacks, mf
from app.core.config import get_settings
from app.core.exceptions import AppException, app_exception_handler, unhandled_exception_handler
from app.core.logging import configure_logging
from app.models.ondc import Base
from app.db import engine

configure_logging()
log = structlog.get_logger(__name__)
settings = get_settings()


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        structlog.contextvars.bind_contextvars(request_id=request_id, path=request.url.path)
        try:
            response = await call_next(request)
            response.headers['X-Request-ID'] = request_id
            return response
        finally:
            structlog.contextvars.clear_contextvars()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    log.info('application_starting', app=settings.APP_NAME, env=settings.ENV)
    await _init_database_with_retry()
    yield
    log.info('application_stopping')


async def _init_database_with_retry(attempts: int = 10, delay_seconds: float = 2.0) -> None:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            return
        except Exception as exc:
            last_error = exc
            log.warning('database_startup_wait', attempt=attempt, attempts=attempts, error=str(exc))
            if attempt < attempts:
                await asyncio.sleep(delay_seconds)
    if last_error:
        raise last_error


def create_app() -> FastAPI:
    app = FastAPI(
        title='ONDC Mutual Fund Buyer Adapter',
        version='0.1.0',
        debug=settings.DEBUG,
        lifespan=lifespan,
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'] if settings.ENV == 'local' else [],
        allow_credentials=True,
        allow_methods=['GET', 'POST', 'OPTIONS'],
        allow_headers=['*'],
    )
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    app.include_router(health.router)
    app.include_router(registry.router)
    app.include_router(callbacks.router)
    app.include_router(mf.router, prefix=settings.API_PREFIX)
    return app


app = create_app()
