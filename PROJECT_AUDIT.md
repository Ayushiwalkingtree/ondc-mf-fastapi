# ONDC MF FastAPI Project Audit

Audit date: 2026-06-04  
Scope: Existing FastAPI codebase only. No implementation changes were made.

## Readiness Score

**42 / 100**

This project is a useful ONDC Mutual Fund buyer-adapter skeleton, but it is **not sufficient yet for ONDC Registry onboarding success, Staging certification, Pramaan completion, or production buyer-app operation**. The main blockers are registry subscribe payload generation, exact `/on_subscribe` challenge decryption, callback signature verification, ONDC/Beckn signature compliance validation, and Mutual Fund FIS payload/schema alignment.

Reference checks used:

- ONDC Registry onboarding docs: https://github.com/ONDC-Official/developer-docs/blob/main/registry/Onboarding%20of%20Participants.md
- ONDC Pramaan guide: https://www.ondc.org/pramaan/how-to-guide.html
- ONDC Pramaan portal: https://www.ondc.org/pramaan/

## Registry Onboarding Readiness

Status: **Partially ready, not onboarding-ready**

Present:

- `app/utils/crypto.py`: Ed25519 signing and verification primitives exist through PyNaCl.
- `scripts/generate_keys.py`: Generates Ed25519 signing keys and X25519 encryption keys.
- `scripts/generate_site_verification.py`: Generates `ondc-site-verification.html` with an Ed25519 signature over a request id.
- `app/api/v1/registry.py`: Exposes `POST /ondc/on_subscribe`.
- `app/services/registry.py`: Has a registry lookup client method.

Missing or not sufficient:

- `app/api/v1/registry.py`: Challenge decryption is not registry-ready. It uses `ONDC_ENCRYPTION_PUBLIC_KEY_B64` as the sender public key fallback, but registry challenge decryption must use the participant encryption private key and the ONDC environment public key/shared-secret flow required by registry onboarding.
- `app/utils/crypto.py`: X25519 encryption key handling uses raw PyNaCl public key bytes. ONDC onboarding expects the encryption public key in the format required by the registry onboarding utility/spec, commonly ASN.1 DER base64 for the public key.
- `scripts/generate_keys.py`: Does not emit DER-formatted X25519 encryption public key for registry subscription.
- `app/services/registry.py`: Lookup points to `/lookup`, while current onboarding docs recommend `/v2.0/lookup`.
- `app/services/registry.py`: Lookup request hard-codes `type: BPP`; this is wrong for buyer-app lookup/registration use cases.
- `app/api/v1/registry.py` and `app/services/registry.py`: No public route exists to trigger lookup from this service.
- Code missing: There is no `/subscribe` payload builder or caller for registry onboarding.
- Config missing: There is no dedicated `callback_url` setting, and no ONDC environment public key setting for `/on_subscribe`.
- Deployment missing: Generated `ondc-site-verification.html` is not served by FastAPI or otherwise mounted in Docker.

## Staging Readiness

Status: **Not ready**

The project can run as an API skeleton, but staging onboarding requires real subscriber configuration, whitelisting, a public HTTPS domain, valid TLS, correct registry subscription, successful `/on_subscribe`, and lookup success. These are not fully implemented or configured here.

Blockers:

- `.env.example`: Contains placeholder `ONDC_SUBSCRIBER_ID`, `ONDC_SUBSCRIBER_URI`, and empty key values.
- `app/core/config.py`: No `ONDC_CALLBACK_URL` or `ONDC_PUBLIC_KEY_B64` / environment registry public key setting.
- `app/services/registry.py`: No staging subscribe client.
- `app/api/v1/registry.py`: `/on_subscribe` challenge flow is not compliant enough for staging registry validation.
- `scripts/generate_site_verification.py`: Generates a file, but the project does not host it at `https://<subscriber_id>/ondc-site-verification.html`.

## Pramaan Readiness

Status: **Not ready**

Present:

- `app/utils/ondc_auth.py`: Builds an Authorization header.
- `app/services/ondc_client.py`: Sends `Content-Type`, `Authorization`, and `X-ONDC-Subscriber-Id`.
- `app/services/context.py`: Generates `transaction_id` and `message_id`.
- `app/services/transaction_log.py`: Logs inbound and outbound payloads.

Missing or not sufficient:

- `app/utils/ondc_auth.py`: The signing implementation includes a warning comment saying the exact signature base must be confirmed. This must be validated against ONDC signing utilities before Pramaan.
- `app/utils/ondc_auth.py`: The Authorization header omits the `headers="(created)(expires)digest"` parameter used in ONDC examples.
- `app/utils/ondc_auth.py`: Digest generation signs canonical JSON bytes directly after `BLAKE-512=` rather than a clearly computed BLAKE2b-512 digest string. This is likely not ONDC-compliant.
- `app/api/v1/callbacks.py`: Inbound callback Authorization is accepted but not verified.
- `app/api/v1/callbacks.py`: No registry lookup is performed to fetch sender public keys for response verification.
- `app/api/v1/callbacks.py`: No NACK behavior for invalid signatures or invalid callback payloads.
- `app/services/transaction_log.py`: Logs transaction and message ids but does not enforce idempotency, replay protection, or callback correlation.
- `app/services/context.py`: New `message_id` is generated for every outbound action, but there is no persisted flow state to validate callback `transaction_id`/`message_id` relationships.

## Search Flow Readiness

Status: **Partially ready for local smoke tests, not ready for ONDC MF certification**

Implemented routes:

- `POST /api/v1/mf/search` in `app/api/v1/mf.py`
- `POST /ondc/on_search` in `app/api/v1/callbacks.py`
- `POST /api/v1/mf/select` in `app/api/v1/mf.py`
- `POST /ondc/on_select` in `app/api/v1/callbacks.py`
- `POST /api/v1/mf/init` in `app/api/v1/mf.py`
- `POST /ondc/on_init` in `app/api/v1/callbacks.py`
- `POST /api/v1/mf/confirm` in `app/api/v1/mf.py`
- `POST /ondc/on_confirm` in `app/api/v1/callbacks.py`
- `POST /api/v1/mf/status` in `app/api/v1/mf.py`
- `POST /ondc/on_status` in `app/api/v1/callbacks.py`

Limitations:

- `app/services/mf_mapper.py`: Mapper is intentionally generic and warns that exact Mutual Fund FIS fields must be aligned with ONDC Swagger/Workbench examples.
- `app/schemas/mf.py`: Internal request schemas are minimal and do not enforce ONDC Mutual Fund required fields, enum values, quote structures, fulfillment structures, form fields, payment/mandate details, KYC, or compliance artifacts.
- `app/api/v1/callbacks.py`: Callbacks only ACK and log; they do not parse catalogs, offers, orders, forms, quotes, payment instructions, status state, or errors into usable buyer-app state.
- `app/api/v1/mf.py`: Select/init/confirm/status depend on caller-provided `bpp_uri` query params instead of using discovered registry/search results.
- `app/services/context.py`: Context uses `core_version`; depending on the target ONDC/FIS spec, this may need to match current protocol field naming/version requirements.

## Environment Configuration

Supported:

- `subscriber_id`: `ONDC_SUBSCRIBER_ID` in `app/core/config.py` and `.env.example`
- `subscriber_url`: `ONDC_SUBSCRIBER_URI` in `app/core/config.py` and `.env.example`
- `unique_key_id`: `ONDC_UNIQUE_KEY_ID` in `app/core/config.py` and `.env.example`
- Registry URL: `ONDC_REGISTRY_URL` in `app/core/config.py` and `.env.example`
- Gateway URL: `ONDC_GATEWAY_SEARCH_URL` in `app/core/config.py` and `.env.example`
- Signing keys: `ONDC_SIGNING_PRIVATE_KEY_B64`, `ONDC_SIGNING_PUBLIC_KEY_B64`
- Encryption keys: `ONDC_ENCRYPTION_PRIVATE_KEY_B64`, `ONDC_ENCRYPTION_PUBLIC_KEY_B64`
- Database: `DATABASE_URL`
- Redis: `REDIS_URL`

Not supported or insufficient:

- `callback_url`: No dedicated `ONDC_CALLBACK_URL`; registry subscription needs a relative callback path.
- ONDC registry public encryption key: No environment-specific setting used by `/on_subscribe`.
- Registry `/subscribe` endpoint URL/path: No setting or client method.
- Registry `/v2.0/lookup` URL/path: Current lookup builds `/lookup`.
- Sender public key cache: No Redis/PostgreSQL-backed cache despite `ONDC_LOOKUP_CACHE_SECONDS`.

## Deployment Readiness

Status: **Partially ready for local/container smoke testing**

Present:

- `Dockerfile`: Builds and runs FastAPI with Uvicorn.
- `docker-compose.yml`: Starts API, PostgreSQL, and Redis.
- `app/db.py`: Async PostgreSQL engine is configured.
- `app/main.py`: Creates tables at startup using SQLAlchemy metadata.
- `.env.example`: Documents required environment variables.

Issues:

- `docker-compose.yml` and `.env.example`: `DATABASE_URL` defaults to `localhost`; inside the API container this should point to `db`, not `localhost`.
- `docker-compose.yml`: No healthchecks for API, Postgres, or Redis.
- `app/db.py`: No startup retry/backoff for database readiness.
- `alembic.ini`: References Alembic, but no migration script directory exists in the repo.
- `app/main.py`: Uses `Base.metadata.create_all` at startup; acceptable for skeleton use, not production migration management.
- `REDIS_URL` is configured and Redis is launched, but no code uses Redis.
- No production secret management, vault integration, key rotation, TLS termination config, observability export, or rate limiting.

## Verification Performed

- Static inspection of all project files.
- `pytest -q`: Failed because `pytest` is not on PATH.
- `python -m pytest -q`: Failed during test collection because `nacl` / PyNaCl is not installed in the active Python environment.

## Missing Items

### A. Code Missing

| File | Reason | Exact fix required |
|---|---|---|
| `app/services/registry.py` | No registry `/subscribe` payload generation or submit method. | Add a registry subscribe payload builder and client call for buyer-app registration with `subscriber_id`, `subscriber_url`, `callback_url`, signing public key, encryption public key, `unique_key_id`, domain, country, city, and buyer-app `ops_no`/NP type fields as per current ONDC registry schema. |
| `app/api/v1/registry.py` | `/on_subscribe` uses own public encryption key as sender key fallback. | Add environment-specific ONDC public encryption key configuration and decrypt challenge using the ONDC-prescribed shared-secret/AES flow. |
| `app/utils/crypto.py` | X25519 helpers use PyNaCl Box format, not explicitly the ONDC registry challenge format. | Implement ONDC utility-compatible key conversion and challenge decrypt/encrypt helpers, including DER public-key handling where required. |
| `scripts/generate_keys.py` | Encryption public key output is raw X25519 bytes. | Output registry-compatible base64 encryption public key format required by ONDC onboarding, not only raw PyNaCl bytes. |
| `app/api/v1/callbacks.py` | Inbound callbacks are not signature verified. | Use registry lookup to fetch sender public key, call `verify_authorization_header`, reject invalid/expired signatures, and log NACK/error details. |
| `app/utils/ondc_auth.py` | Authorization signature base is not confirmed and likely not exact ONDC format. | Align with ONDC signing utility: compute BLAKE2b-512 body digest, sign the exact `(created)`, `(expires)`, and `digest` signing string, and include required header metadata. |
| `app/services/registry.py` | Lookup uses `/lookup` and hard-coded `type: BPP`. | Support `/v2.0/lookup`; make subscriber type configurable and correct for buyer-app lookup. |
| `app/api/v1/registry.py` | No public lookup endpoint. | Add an internal/admin route if this service is expected to initiate lookup checks from API calls. |
| `app/services/mf_mapper.py` | MF FIS payloads are generic. | Replace generic mapper fields with exact ONDC Mutual Fund FIS search/select/init/confirm/status payloads and enums from the target Swagger/Workbench examples. |
| `app/api/v1/callbacks.py` | Callback payloads are only ACKed/logged. | Parse and persist on_search catalog, on_select quote, on_init form/payment details, on_confirm order, and on_status state/errors. |
| `app/services/transaction_log.py` | No idempotency/replay enforcement. | Add unique handling or checks for `transaction_id + message_id + action + direction`; return safe ACK/NACK behavior for duplicates. |
| `app/services/context.py` | Flow state is not persisted. | Persist generated `transaction_id` and `message_id` per action and validate callbacks against pending outbound requests. |

### B. Configuration Missing

| File | Reason | Exact fix required |
|---|---|---|
| `app/core/config.py` | No `callback_url` field. | Add `ONDC_CALLBACK_URL` for the relative registry callback path, for example `/ondc`. |
| `.env.example` | No callback URL value. | Add `ONDC_CALLBACK_URL=/ondc` or the deployed relative path used during subscribe. |
| `app/core/config.py` | No ONDC environment public key setting. | Add `ONDC_REGISTRY_PUBLIC_KEY_B64` or per-env public key settings for staging/pre-prod/prod challenge decryption. |
| `.env.example` | Keys are empty placeholders. | Fill environment-specific signing/encryption keys generated for the real subscriber. |
| `.env.example` | Subscriber values are placeholders. | Replace `your-domain.com` and URI with the real public HTTPS subscriber domain and BAP URI. |
| `.env.example` | API container database URL uses `localhost`. | For Docker Compose, set `DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/ondc_mf`. |
| `app/core/config.py` | No separate pre-prod/prod registry/gateway config strategy. | Add explicit env-specific URLs or deployment-specific `.env` files. |

### C. ONDC Credentials Missing

| File | Reason | Exact fix required |
|---|---|---|
| `.env.example` | No real `ONDC_SUBSCRIBER_ID`. | Obtain and configure the approved subscriber id/FQDN. |
| `.env.example` | No real `ONDC_SUBSCRIBER_URI`. | Configure the deployed HTTPS BAP URI reachable by ONDC participants. |
| `.env.example` | No signing private/public key values. | Generate ONDC-compatible Ed25519 keys and configure both values. |
| `.env.example` | No encryption private/public key values. | Generate ONDC-compatible X25519 keys with registry-compatible public key format and configure both values. |
| `.env.example` | `ONDC_UNIQUE_KEY_ID` is a placeholder. | Set a unique production/staging key id used in registry records and Authorization headers. |
| `.env.example` | Gateway URL may be environment/domain-specific. | Confirm and configure the current gateway URL for the target Mutual Fund/FIS staging environment. |

### D. ONDC Portal / Whitelisting Requirements

| File | Reason | Exact fix required |
|---|---|---|
| `README.md` | Notes onboarding steps but does not capture portal prerequisites. | Add operational runbook entries for Buy-side TSP registration, NP portal profile completion, staging/pre-prod/prod access requests, and whitelisting status tracking. |
| External portal | Subscriber is not automatically whitelisted by code. | Register/complete profile in ONDC participant portal and request environment access/whitelisting for the exact subscriber id. |
| External DNS/TLS | Registry validation requires public HTTPS reachability. | Configure public DNS, valid SSL certificate, and expose `/ondc/on_subscribe` and site verification file on the subscriber domain. |
| External registry | No evidence of subscribe success. | Submit corrected subscribe payload and confirm ACK from staging registry. |
| External registry | No evidence of lookup success. | Call `/v2.0/lookup` after subscribe and verify the subscriber record. |

### E. Production Requirements

| File | Reason | Exact fix required |
|---|---|---|
| `app/api/v1/callbacks.py` | No inbound signature verification. | Make signature verification mandatory for all ONDC callbacks before production. |
| `app/utils/ondc_auth.py` | Request signing is not certified against ONDC utilities. | Add compatibility tests using official ONDC signing/verification vectors/utilities. |
| `app/services/mf_mapper.py` | MF business and compliance flow is incomplete. | Add KYC, suitability/risk disclosure, bank/mandate/payment, ARN/EUIN, consent, reconciliation, cancellation, and IGM support as required for MF production. |
| `app/main.py` | Startup uses auto table creation. | Replace with Alembic migrations and production deployment migration process. |
| `alembic.ini` | Migration folder is absent. | Add Alembic migration environment and initial schema migration. |
| `docker-compose.yml` | No healthchecks or production hardening. | Add healthchecks, resource limits, restart policy, network restrictions, and production secrets injection. |
| `app/core/config.py` | Private keys are loaded from environment. | Move private keys to a vault/KMS and implement key rotation. |
| `app/api/v1/mf.py` | Internal API auth is disabled when key is default. | Require strong internal auth in non-local environments. |
| `app/services/transaction_log.py` | No audit retention or masking policy. | Define retention, PII masking/encryption, secure audit access, and operational dashboards. |
| `app/api/v1/health.py` | Readiness does not check dependencies. | Make readiness verify PostgreSQL, Redis if used, and critical ONDC config presence. |

## Exact Missing Items Summary

| Area | File | Reason | Exact fix required |
|---|---|---|---|
| Registry subscribe | `app/services/registry.py` | Missing subscribe builder/caller. | Add ONDC `/subscribe` payload generation and submit method. |
| Callback URL config | `app/core/config.py`, `.env.example` | Missing dedicated callback URL. | Add and configure `ONDC_CALLBACK_URL`. |
| Challenge decryption | `app/api/v1/registry.py`, `app/utils/crypto.py` | Uses wrong sender key assumption and generic Box decrypt. | Implement ONDC registry challenge decrypt using environment ONDC public key and expected shared-secret/AES flow. |
| Encryption key format | `scripts/generate_keys.py` | Outputs raw X25519 public key. | Emit registry-compatible DER/base64 encryption public key. |
| Site verification hosting | `scripts/generate_site_verification.py`, `Dockerfile`, `app/main.py` | File can be generated but is not served. | Serve generated file at `https://<subscriber_id>/ondc-site-verification.html` in deployment. |
| Lookup | `app/services/registry.py` | Uses older `/lookup`; hard-codes BPP. | Use `/v2.0/lookup` and correct buyer-app type/filters. |
| Request signing | `app/utils/ondc_auth.py` | Signature base/digest not proven ONDC-compliant. | Align with official ONDC signing utility and add test vectors. |
| Response verification | `app/api/v1/callbacks.py` | Authorization header ignored. | Fetch public key by lookup and verify every callback. |
| Transaction handling | `app/services/context.py`, `app/services/transaction_log.py` | IDs are generated/logged but not validated as a flow. | Persist flow state, correlate callbacks, enforce idempotency/replay protection. |
| MF payloads | `app/services/mf_mapper.py`, `app/schemas/mf.py` | Generic payloads are not certification-grade. | Implement exact Mutual Fund FIS schema fields/enums. |
| Docker DB connectivity | `.env.example`, `docker-compose.yml` | Container default points to `localhost`. | Use `db` hostname in Compose environment. |
| Redis connectivity | `app/core/config.py`, `docker-compose.yml` | Redis exists but unused. | Either implement cache/health usage or remove from readiness claims. |
| Migrations | `alembic.ini` | Alembic configured but migration folder absent. | Add Alembic env and initial migration. |

[ ] Buy-side TSP Registration
[ ] Subscriber ID
[ ] Public HTTPS Domain
[ ] SSL Certificate
[ ] Ed25519 Keys
[ ] X25519 Keys
[ ] ondc-site-verification.html
[ ] /on_subscribe
[ ] Registry Subscribe Success
[ ] Registry Lookup Success
[ ] Staging Whitelisting
[ ] Search API Ready
[ ] Search Callback Ready
