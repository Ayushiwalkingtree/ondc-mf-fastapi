# Implementation Report

Date: 2026-06-04

## Goal

Implement only the critical blockers needed for ONDC Registry onboarding readiness and Mutual Fund buyer-app search-flow smoke testing, without refactoring the project architecture.

## Implemented

### P0 - Registry Onboarding

- Added `ONDC_CALLBACK_URL`, `ONDC_REGISTRY_PUBLIC_KEY_B64`, `ONDC_SUBSCRIBE_URL`, `ONDC_LOOKUP_TYPE`, `ONDC_REGISTRY_SUBSCRIBER_TYPE`, and site-verification settings in `app/core/config.py` and `.env.example`.
- Replaced `/on_subscribe` challenge handling with ONDC registry-compatible X25519 shared-secret + AES decrypt flow in `app/utils/crypto.py` and `app/api/v1/registry.py`.
- Updated `scripts/generate_keys.py` to output X25519 encryption public keys in DER/base64 format for registry subscription.
- Added registry subscribe payload builder and submit client in `app/services/registry.py`.
- Updated registry lookup to `/v2.0/lookup` and made lookup type configurable.
- Added FastAPI serving for `ondc-site-verification.html` at `/ondc-site-verification.html`.

### P1 - ONDC Signing Compliance

- Updated Authorization header generation to include `headers="(created)(expires)digest"`.
- Added BLAKE2b-512 body digest generation.
- Changed signing to use the exact raw JSON body sent over HTTP.
- Added raw-body signature verification support.
- Updated ONDC callbacks to verify inbound Authorization signatures and return NACK for invalid/missing signatures.

### P2 - Search Flow Readiness

- Added idempotency protection for repeated inbound `action + direction + transaction_id + message_id`.
- Continued persisting all callback payloads, including `on_search` catalogs.
- Added BPP URI discovery from accepted `on_search` callbacks.
- Made `select`, `init`, `confirm`, and `status` use discovered BPP URI when `bpp_uri` is not supplied.

### P3 - Deployment Fixes

- Updated `docker-compose.yml` to use `db` and `redis` service hostnames.
- Added Docker healthchecks for API, PostgreSQL, and Redis.
- Added startup retry around database initialization.
- Added Alembic async environment and initial transaction-log migration.
- Updated readiness endpoint to check PostgreSQL and Redis.

## Validation

- `python -m compileall app scripts alembic`: passed
- `python -m pytest -q`: passed, 2 tests
- `python -m ruff check .`: passed
- `python scripts/generate_keys.py`: passed and produced DER/base64 X25519 public key
- `python -c "from app.main import app; print(app.title)"`: passed

Note: `python -m pip install -r requirements.txt` was run to install missing project dependencies. The shared Python user environment reported unrelated dependency conflict warnings for other globally installed packages.

## Current Readiness

Registry Readiness Score: **82 / 100**

Search Readiness Score: **72 / 100**

## Remaining Blockers for Pramaan

- Validate generated Authorization headers against the current official ONDC crypto SDK/test vectors.
- Configure real subscriber credentials, registry-approved keys, and reachable staging HTTPS domain.
- Ensure callback sender public keys resolve correctly from staging `/v2.0/lookup`.
- Align Mutual Fund `search` payload fields and enums with the active FIS Swagger/Pramaan examples.
- Add domain-specific validation for `on_search` catalog schema and error responses.

## Remaining Blockers for Production

- Add complete Mutual Fund business/compliance flows: KYC, mandate, payments, ARN/EUIN, suitability, reconciliation, cancellation, and IGM.
- Move private keys out of `.env` into vault/KMS with rotation.
- Replace startup `create_all` with migration-only production rollout.
- Add production observability, audit retention, PII masking/encryption, rate limiting, and operational alerts.
- Complete ONDC portal whitelisting, staging certification, pre-prod validation, and production approval.
