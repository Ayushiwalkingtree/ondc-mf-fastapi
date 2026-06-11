from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import subprocess
from typing import AsyncGenerator
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import structlog
import uuid

from app.api.v1 import health, registry, callbacks, mf, websocket
from app.core.config import get_settings
from app.core.exceptions import AppException, app_exception_handler, unhandled_exception_handler
from app.core.logging import configure_logging
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
    log.info(
        'APPLICATION_RUNTIME_FINGERPRINT',
        git_hash=_git_hash(),
        startup_timestamp=datetime.now(timezone.utc).isoformat(),
        main_module_file=__file__,
        mf_module_file=mf.__file__,
        transaction_log_module_file=_transaction_log_module_file(),
    )
    if settings.NO_DATABASE:
        log.info('database_startup_skipped', no_database=True)
    else:
        await _init_database_with_retry()
    yield
    log.info('application_stopping')


async def _init_database_with_retry(attempts: int = 10, delay_seconds: float = 2.0) -> None:
    if engine is None:
        log.info('database_startup_skipped', no_database=True)
        return
    from app.models.ondc import Base

    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{settings.DATABASE_SCHEMA}"'))
                await conn.execute(text(f'SET search_path TO "{settings.DATABASE_SCHEMA}"'))
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
        allow_origins=settings.cors_allow_origins,
        allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allow_headers=[
            'Accept',
            'Accept-Language',
            'Authorization',
            'Content-Language',
            'Content-Type',
            'X-Request-ID',
            'X-Requested-With',
        ],
        expose_headers=['X-Request-ID'],
    )
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    app.include_router(health.router)
    app.include_router(registry.router)
    app.include_router(callbacks.router)
    app.include_router(websocket.router)
    app.include_router(mf.router, prefix=settings.API_PREFIX)
    return app


app = create_app()


def _git_hash() -> str | None:
    try:
        repo_root = Path(__file__).resolve().parents[1]
        return subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'],
            cwd=repo_root,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return None


def _transaction_log_module_file() -> str:
    from app.services import transaction_log

    return transaction_log.__file__
