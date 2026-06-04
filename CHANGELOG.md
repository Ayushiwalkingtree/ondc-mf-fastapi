# Changelog

## 2026-06-04

### Added

- ONDC callback URL, registry public key, subscribe URL, lookup type, subscriber type, callback verification, and site-verification configuration.
- ONDC registry subscribe payload builder and submit client.
- `/v2.0/lookup` registry lookup support with configurable lookup type.
- Root `/ondc-site-verification.html` serving.
- ONDC raw-body Authorization signing with BLAKE2b-512 digest.
- Inbound callback signature verification with NACK responses.
- Callback idempotency check for repeated transaction/message/action callbacks.
- BPP URI discovery from accepted `on_search` callbacks.
- Alembic async environment and initial transaction-log migration.
- Docker Compose healthchecks and app startup database retry.

### Changed

- `/ondc/on_subscribe` now decrypts registry challenges using X25519 shared secret and AES instead of the local public-key fallback.
- Key generation now emits DER/base64 X25519 encryption public keys for registry onboarding.
- Outbound ONDC requests now sign and send the exact same JSON body bytes.
- `select`, `init`, `confirm`, and `status` can use the BPP URI discovered from `on_search`.
- Readiness endpoint now checks PostgreSQL and Redis connectivity.
- Docker Compose now uses `db` and `redis` service hostnames for container networking.

### Not Implemented

- SIP flows
- Payment flows
- KYC
- Mandate
- ARN/EUIN
- IGM
- Production compliance features
