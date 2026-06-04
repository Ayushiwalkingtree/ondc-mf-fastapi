import re
import base64
import hashlib
import time
from dataclasses import dataclass
from typing import Any
from app.core.config import get_settings
from app.utils.crypto import sign_ed25519, verify_ed25519
from app.utils.json import canonical_bytes

AUTH_RE = re.compile(r'(\w+)="([^"]*)"')


@dataclass(frozen=True)
class AuthHeader:
    subscriber_id: str
    unique_key_id: str
    signature: str
    created: str
    expires: str


def build_authorization_header(payload: dict[str, Any], ttl_seconds: int = 300) -> str:
    from app.utils.json import dumps

    return build_authorization_header_from_body(dumps(payload), ttl_seconds)


def build_authorization_header_from_body(body: str | bytes, ttl_seconds: int = 300) -> str:
    settings = get_settings()
    created = str(int(time.time()))
    expires = str(int(time.time()) + ttl_seconds)
    signing_string = _build_signing_string(body, created, expires)
    signature = sign_ed25519(signing_string, settings.ONDC_SIGNING_PRIVATE_KEY_B64)
    key_id = f'{settings.ONDC_SUBSCRIBER_ID}|{settings.ONDC_UNIQUE_KEY_ID}|ed25519'
    return (
        'Signature '
        f'keyId="{key_id}",'
        'algorithm="ed25519",'
        f'created="{created}",'
        f'expires="{expires}",'
        'headers="(created)(expires)digest",'
        f'signature="{signature}"'
    )


def parse_authorization_header(header: str) -> AuthHeader:
    parts = dict(AUTH_RE.findall(header or ''))
    key_id = parts.get('keyId', '')
    key_parts = key_id.split('|')
    if len(key_parts) < 2:
        raise ValueError('Invalid keyId in authorization header')
    return AuthHeader(
        subscriber_id=key_parts[0],
        unique_key_id=key_parts[1],
        signature=parts.get('signature', ''),
        created=parts.get('created', ''),
        expires=parts.get('expires', ''),
    )


def verify_authorization_header(payload: dict[str, Any] | str | bytes, header: str, public_key_b64: str) -> AuthHeader:
    auth = parse_authorization_header(header)
    now = int(time.time())
    if int(auth.created or '0') > now:
        raise ValueError('Signature created timestamp is in the future')
    if int(auth.expires or '0') < now:
        raise ValueError('Signature expired')
    signing_string = _build_signing_string(payload, auth.created, auth.expires)
    verify_ed25519(signing_string, auth.signature, public_key_b64)
    return auth


def _build_signing_string(payload: dict[str, Any] | str | bytes, created: str, expires: str) -> bytes:
    digest = create_blake512_digest(payload)
    return (
        f'(created): {created}\n'
        f'(expires): {expires}\n'
        f'digest: BLAKE-512={digest}'
    ).encode('utf-8')


def create_blake512_digest(payload: dict[str, Any] | str | bytes) -> str:
    if isinstance(payload, bytes):
        body = payload
    elif isinstance(payload, str):
        body = payload.encode('utf-8')
    else:
        body = canonical_bytes(payload)
    digest = hashlib.blake2b(body, digest_size=64).digest()
    return base64.b64encode(digest).decode('utf-8')
