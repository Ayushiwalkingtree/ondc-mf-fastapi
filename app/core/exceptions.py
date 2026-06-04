from fastapi import Request
from fastapi.responses import ORJSONResponse
from starlette import status
import structlog

log = structlog.get_logger(__name__)


class AppException(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = 'APP_ERROR') -> None:
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class OndcSignatureError(AppException):
    def __init__(self, message: str = 'Invalid ONDC signature') -> None:
        super().__init__(message, status.HTTP_401_UNAUTHORIZED, 'ONDC_SIGNATURE_ERROR')


class OndcClientError(AppException):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message, status_code, 'ONDC_CLIENT_ERROR')


async def app_exception_handler(_: Request, exc: AppException) -> ORJSONResponse:
    log.warning('app_exception', code=exc.code, message=exc.message, status_code=exc.status_code)
    return ORJSONResponse(
        status_code=exc.status_code,
        content={'error': {'code': exc.code, 'message': exc.message}},
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> ORJSONResponse:
    log.exception('unhandled_exception', error=str(exc))
    return ORJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Unexpected server error'}},
    )
