from functools import lru_cache
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', case_sensitive=True, extra='ignore')

    APP_NAME: str = 'ondc-mf-fastapi'
    ENV: str = 'local'
    DEBUG: bool = False
    LOG_LEVEL: str = 'INFO'
    API_PREFIX: str = '/api/v1'

    DATABASE_URL: str = 'postgresql+asyncpg://postgres:postgres@localhost:5432/ondc_mf'
    DATABASE_SCHEMA: str = 'public'
    REDIS_URL: str = 'redis://localhost:6379/0'
    NO_DATABASE: bool = False
    DEBUG_PRINT_PAYLOADS: bool = False
    ENABLE_SELECT_DEBUG_BYPASS: bool = False
    ENABLE_SELECT_NEW_TXN_ID: bool = False
    CORS_ALLOW_ORIGINS: str = (
        'http://localhost:5173,'
        'http://127.0.0.1:5173,'
        'http://localhost:3000,'
        'http://127.0.0.1:3000,'
        'https://ondcapi.walkingtree.tech'
    )
    CORS_ALLOW_ORIGIN_REGEX: str | None = r'https?://(localhost|127\.0\.0\.1)(:\d+)?'

    ONDC_ENV: str = 'staging'
    ONDC_DOMAIN: str = 'ONDC:FIS14'
    ONDC_COUNTRY: str = 'IND'
    ONDC_CITY: str = 'std:080'
    ONDC_CORE_VERSION: str = '1.2.0'
    ONDC_CONTEXT_TTL: str = 'PT10M'
    ONDC_SUBSCRIBER_ID: str = Field('your-domain.com', min_length=3)
    ONDC_SUBSCRIBER_URI: str = Field('https://your-domain.com/ondc', min_length=8)
    ONDC_CALLBACK_URL: str = '/ondc'
    ONDC_UNIQUE_KEY_ID: str = 'key-1'
    ONDC_SIGNING_PRIVATE_KEY_B64: str = ''
    ONDC_SIGNING_PUBLIC_KEY_B64: str = ''
    ONDC_ENCRYPTION_PRIVATE_KEY_B64: str = ''
    ONDC_ENCRYPTION_PUBLIC_KEY_B64: str = ''
    ONDC_REGISTRY_PUBLIC_KEY_B64: str = 'MCowBQYDK2VuAyEAduMuZgmtpjdCuxv+Nc49K0cB6tL/Dj3HZetvVN7ZekM='
    ONDC_REGISTRY_URL: str = 'https://staging.registry.ondc.org'
    ONDC_SUBSCRIBE_URL: str = ''
    ONDC_GATEWAY_SEARCH_URL: str = ''
    ONDC_LOOKUP_TYPE: str = 'BAP'
    ONDC_REGISTRY_SUBSCRIBER_TYPE: str = 'buyerApp'
    ONDC_REQUEST_TIMEOUT_SECONDS: int = 30
    ONDC_WORKBENCH_EXPECTATION_URL: str = 'https://workbench.ondc.tech/backend-ui/sessions/expectation'
    ONDC_WORKBENCH_SUBSCRIBER_URL: str | None = None
    ONDC_SEARCH_RESTART_DELAY_SECONDS: float = 2.0
    ONDC_LOOKUP_CACHE_SECONDS: int = 900
    ONDC_SITE_VERIFICATION_FILE: str = 'ondc-site-verification.html'
    ONDC_VERIFY_CALLBACK_SIGNATURES: bool = True
    ONDC_CALLBACK_SIGNING_PUBLIC_KEY_B64: str = ''

    INTERNAL_API_KEY: str = 'change-me'

    @field_validator('DEBUG', mode='before')
    @classmethod
    def parse_debug(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {'debug', 'true', '1', 'yes', 'on'}:
                return True
            if normalized in {'release', 'prod', 'production', 'false', '0', 'no', 'off', 'warn', 'warning', 'info', 'error'}:
                return False
        return value

    @field_validator('DATABASE_SCHEMA')
    @classmethod
    def validate_database_schema(cls, value: str) -> str:
        if not value.replace('_', '').isalnum() or value[0].isdigit():
            raise ValueError('DATABASE_SCHEMA must be a simple PostgreSQL identifier')
        return value

    @property
    def cors_allow_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.CORS_ALLOW_ORIGINS.split(',')
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
