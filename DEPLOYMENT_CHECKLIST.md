# Deployment Checklist - ONDC MF FastAPI

Audit date: 2026-06-04  
Subscriber ID: `ondcapi.walkingtree.tech`  
Required BAP URI: `https://ondcapi.walkingtree.tech/ondc`  
Domain: `ONDC:FIS14`  
Gateway: `https://staging.gateway.proteantech.in/search`

Local verification performed:

- FastAPI route introspection: passed.
- `python -m compileall app scripts alembic`: passed.
- `python -m pytest -q`: passed, `2 passed`.
- `ondc-site-verification.html`: missing in the repository root; current public route will return `404` until generated or mounted.
- Sanitized `.env` check: ONDC keys are set, but `ONDC_SUBSCRIBER_URI` is still `https://your-domain.com/ondc` and must be corrected.

References checked:

- ONDC Registry onboarding guide: https://github.com/ONDC-Official/developer-docs/blob/main/registry/Onboarding%20of%20Participants.md
- ONDC Financial Services developer guide and Workbench entrypoint: https://ondc-official.github.io/ONDC-FIS-Specifications/
- ONDC Pramaan guide: https://www.ondc.org/pramaan/how-to-guide.html

## A. Public URLs Required

These URLs must be reachable from the public internet over valid HTTPS before registry onboarding or Workbench testing:

- `https://ondcapi.walkingtree.tech/health/live`
- `https://ondcapi.walkingtree.tech/health/ready`
- `https://ondcapi.walkingtree.tech/ondc-site-verification.html`
- `https://ondcapi.walkingtree.tech/docs`
- `https://ondcapi.walkingtree.tech/openapi.json`
- `https://ondcapi.walkingtree.tech/ondc/on_subscribe`
- `https://ondcapi.walkingtree.tech/ondc/on_search`
- `https://ondcapi.walkingtree.tech/ondc/on_select`
- `https://ondcapi.walkingtree.tech/ondc/on_init`
- `https://ondcapi.walkingtree.tech/ondc/on_confirm`
- `https://ondcapi.walkingtree.tech/ondc/on_status`
- `https://ondcapi.walkingtree.tech/api/v1/mf/search`
- `https://ondcapi.walkingtree.tech/api/v1/mf/select`
- `https://ondcapi.walkingtree.tech/api/v1/mf/init`
- `https://ondcapi.walkingtree.tech/api/v1/mf/confirm`
- `https://ondcapi.walkingtree.tech/api/v1/mf/status`

Public HTTPS requirements:

- DNS `ondcapi.walkingtree.tech` resolves to the deployed API gateway or reverse proxy.
- TLS certificate is valid, publicly trusted, not expired, and OCSP-checkable.
- Reverse proxy forwards `/ondc/*`, `/health/*`, `/api/v1/*`, `/docs`, `/openapi.json`, and `/ondc-site-verification.html`.
- Request body must be forwarded unchanged for ONDC signature verification.

## B. Exact Docker Deployment Steps

Run from the repository root.

```bash
# 1. Confirm or create environment file
cp .env.example .env

# 2. Generate ONDC keys only if valid keys are not already issued/configured
python scripts/generate_keys.py

# 3. Put generated values into .env and correct these values
# ONDC_SUBSCRIBER_ID=ondcapi.walkingtree.tech
# ONDC_SUBSCRIBER_URI=https://ondcapi.walkingtree.tech/ondc
# ONDC_GATEWAY_SEARCH_URL=https://staging.gateway.proteantech.in/search
# ENV=staging
# DEBUG=false

# 4. Generate the site verification file using the exact registry subscribe request_id
python scripts/generate_site_verification.py --request-id "<REGISTRY_REQUEST_ID>" --out ondc-site-verification.html

# 5. Build containers
docker compose build

# 6. Start database and Redis
docker compose up -d db redis

# 7. Apply migrations
docker compose run --rm api python -m alembic upgrade head

# 8. Start API
docker compose up -d api

# 9. Check container health and logs
docker compose ps
docker compose logs --tail=100 api

# 10. Verify local container endpoints before exposing DNS
curl -i http://localhost:8000/health/live
curl -i http://localhost:8000/health/ready
curl -i http://localhost:8000/ondc-site-verification.html
```

Production edge steps:

```bash
# Configure DNS:
# ondcapi.walkingtree.tech -> public IP / load balancer

# Configure reverse proxy:
# external https://ondcapi.walkingtree.tech -> api:8000

# Verify public HTTPS:
curl -i https://ondcapi.walkingtree.tech/health/live
curl -i https://ondcapi.walkingtree.tech/health/ready
curl -i https://ondcapi.walkingtree.tech/ondc-site-verification.html
```

## C. Exact Environment Variables Still Required

Must be corrected before deployment:

```env
ENV=staging
DEBUG=false
ONDC_SUBSCRIBER_ID=ondcapi.walkingtree.tech
ONDC_SUBSCRIBER_URI=https://ondcapi.walkingtree.tech/ondc
ONDC_CALLBACK_URL=/ondc
ONDC_DOMAIN=ONDC:FIS14
ONDC_COUNTRY=IND
ONDC_CITY=std:080
ONDC_CORE_VERSION=1.2.0
ONDC_GATEWAY_SEARCH_URL=https://staging.gateway.proteantech.in/search
ONDC_REGISTRY_URL=https://staging.registry.ondc.org
ONDC_REGISTRY_PUBLIC_KEY_B64=MCowBQYDK2VuAyEAduMuZgmtpjdCuxv+Nc49K0cB6tL/Dj3HZetvVN7ZekM=
ONDC_LOOKUP_TYPE=BAP
ONDC_REGISTRY_SUBSCRIBER_TYPE=buyerApp
ONDC_VERIFY_CALLBACK_SIGNATURES=true
INTERNAL_API_KEY=<strong-internal-api-key>
```

Must be present and must match the keys submitted to registry:

```env
ONDC_UNIQUE_KEY_ID=<registry-key-id>
ONDC_SIGNING_PRIVATE_KEY_B64=<ed25519-private-key>
ONDC_SIGNING_PUBLIC_KEY_B64=<ed25519-public-key>
ONDC_ENCRYPTION_PRIVATE_KEY_B64=<x25519-private-key>
ONDC_ENCRYPTION_PUBLIC_KEY_B64=<x25519-public-key-asn1-der-base64>
```

Must be correct for the runtime environment:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/ondc_mf
REDIS_URL=redis://redis:6379/0
ONDC_SITE_VERIFICATION_FILE=ondc-site-verification.html
ONDC_REQUEST_TIMEOUT_SECONDS=30
ONDC_LOOKUP_CACHE_SECONDS=900
```

Optional:

```env
ONDC_SUBSCRIBE_URL=
ONDC_CALLBACK_SIGNING_PUBLIC_KEY_B64=
```

Notes:

- `ONDC_SUBSCRIBE_URL` may stay empty because `app/services/registry.py` falls back to `{ONDC_REGISTRY_URL}/subscribe`.
- `ONDC_CALLBACK_SIGNING_PUBLIC_KEY_B64` may stay empty because `app/api/v1/callbacks.py` resolves sender keys through registry lookup. Set it only for controlled Workbench/local testing with a known sender key.

## D. Registry Onboarding Commands

Generate a unique request id and site verification file:

```bash
REQUEST_ID="$(python -c "import uuid; print(uuid.uuid4())")"
python scripts/generate_site_verification.py --request-id "$REQUEST_ID" --out ondc-site-verification.html
curl -i https://ondcapi.walkingtree.tech/ondc-site-verification.html
```

Subscribe payload shape used by this project:

```json
{
  "context": {
    "operation": {
      "ops_no": 1
    }
  },
  "message": {
    "request_id": "<REGISTRY_REQUEST_ID>",
    "timestamp": "<UTC_TIMESTAMP>",
    "entity": {
      "subscriber_id": "ondcapi.walkingtree.tech",
      "unique_key_id": "<ONDC_UNIQUE_KEY_ID>",
      "callback_url": "/ondc/on_subscribe",
      "key_pair": {
        "signing_public_key": "<ONDC_SIGNING_PUBLIC_KEY_B64>",
        "encryption_public_key": "<ONDC_ENCRYPTION_PUBLIC_KEY_B64>",
        "valid_from": "<UTC_TIMESTAMP>",
        "valid_until": "<UTC_TIMESTAMP_PLUS_1_YEAR>"
      }
    },
    "network_participant": [
      {
        "subscriber_url": "/ondc",
        "domain": "ONDC:FIS14",
        "type": "buyerApp",
        "msn": false,
        "city_code": ["std:080"]
      }
    ]
  }
}
```

Direct subscribe curl:

```bash
curl --location 'https://staging.registry.ondc.org/subscribe' \
  --header 'Content-Type: application/json' \
  --data @subscribe.json
```

Project-native signed subscribe command:

```bash
python -c "import asyncio; from app.services.registry import RegistryClient; async def main(): print(await RegistryClient().subscribe(request_id='<REGISTRY_REQUEST_ID>')); asyncio.run(main())"
```

Use the project-native command when the registry environment expects the same Authorization signing behavior as other ONDC calls.

## E. Registry Lookup Commands

Lookup using registry `/v2.0/lookup`:

```bash
curl --location 'https://staging.registry.ondc.org/v2.0/lookup' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Signature keyId="ondcapi.walkingtree.tech|<ONDC_UNIQUE_KEY_ID>|ed25519",algorithm="ed25519",created="<EPOCH_SECONDS>",expires="<EPOCH_SECONDS_PLUS_300>",headers="(created)(expires)digest",signature="<SIGNATURE>"' \
  --data '{
    "subscriber_id": "ondcapi.walkingtree.tech",
    "country": "IND",
    "domain": "ONDC:FIS14",
    "type": "BAP",
    "city": "std:080"
  }'
```

Project-native signed lookup command:

```bash
python -c "import asyncio; from app.services.registry import RegistryClient; async def main(): print(await RegistryClient().lookup_subscriber('ondcapi.walkingtree.tech', city='std:080')); asyncio.run(main())"
```

Expected result:

- Registry returns `ACK` or a subscriber record containing `ondcapi.walkingtree.tech`.
- The record contains the same signing/encryption public keys and `unique_key_id` configured in `.env`.
- The subscriber is active/subscribed for `ONDC:FIS14` and buyer-app/BAP usage.

## F. Search API Test Commands

Health:

```bash
curl -i https://ondcapi.walkingtree.tech/health/live
curl -i https://ondcapi.walkingtree.tech/health/ready
```

Site verification:

```bash
curl -i https://ondcapi.walkingtree.tech/ondc-site-verification.html
```

Search:

```bash
curl --location 'https://ondcapi.walkingtree.tech/api/v1/mf/search' \
  --header 'Content-Type: application/json' \
  --header 'X-Internal-API-Key: <INTERNAL_API_KEY>' \
  --data '{
    "intent": "mutual funds",
    "city": "std:080",
    "raw_overrides": {
      "context": {
        "domain": "ONDC:FIS14"
      }
    }
  }'
```

Search with provider/category override:

```bash
curl --location 'https://ondcapi.walkingtree.tech/api/v1/mf/search' \
  --header 'Content-Type: application/json' \
  --header 'X-Internal-API-Key: <INTERNAL_API_KEY>' \
  --data '{
    "intent": "equity mutual funds",
    "city": "std:080",
    "provider_id": "<BPP_PROVIDER_ID>",
    "category": "<FIS14_CATEGORY_ID>"
  }'
```

Lookup:

```bash
curl --location 'https://staging.registry.ondc.org/v2.0/lookup' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Signature keyId="ondcapi.walkingtree.tech|<ONDC_UNIQUE_KEY_ID>|ed25519",algorithm="ed25519",created="<EPOCH_SECONDS>",expires="<EPOCH_SECONDS_PLUS_300>",headers="(created)(expires)digest",signature="<SIGNATURE>"' \
  --data '{
    "subscriber_id": "ondcapi.walkingtree.tech",
    "country": "IND",
    "domain": "ONDC:FIS14",
    "type": "BAP",
    "city": "std:080"
  }'
```

Subscribe:

```bash
curl --location 'https://staging.registry.ondc.org/subscribe' \
  --header 'Content-Type: application/json' \
  --data @subscribe.json
```

Callback smoke test:

```bash
curl --location 'https://ondcapi.walkingtree.tech/ondc/on_search' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Signature keyId="<SENDER_SUBSCRIBER_ID>|<SENDER_KEY_ID>|ed25519",algorithm="ed25519",created="<EPOCH_SECONDS>",expires="<EPOCH_SECONDS_PLUS_300>",headers="(created)(expires)digest",signature="<SIGNATURE>"' \
  --data '{
    "context": {
      "domain": "ONDC:FIS14",
      "country": "IND",
      "city": "std:080",
      "action": "on_search",
      "core_version": "1.2.0",
      "bap_id": "ondcapi.walkingtree.tech",
      "bap_uri": "https://ondcapi.walkingtree.tech/ondc",
      "bpp_id": "<SENDER_SUBSCRIBER_ID>",
      "bpp_uri": "<SENDER_BPP_URI>",
      "transaction_id": "<TRANSACTION_ID>",
      "message_id": "<MESSAGE_ID>",
      "timestamp": "<UTC_TIMESTAMP>"
    },
    "message": {
      "catalog": {
        "providers": []
      }
    }
  }'
```

## G. Workbench Troubleshooting

| NACK scenario | Root cause | File responsible | Exact fix |
|---|---|---|---|
| `Subscriber Id is not whitelisted` | Subscriber is not approved for staging/pre-prod/prod portal access. | External ONDC portal; no code file. | Complete ONDC portal profile and environment access request for `ondcapi.walkingtree.tech`; wait for whitelisting approval. |
| `Timestamp is invalid` | Subscribe payload timestamp, Authorization `created`, or `expires` is outside allowed clock skew. | `app/services/registry.py`, `app/utils/ondc_auth.py`, host OS clock. | Sync server time with NTP; regenerate subscribe payload immediately before sending; keep Authorization TTL near 300 seconds. |
| `Domain verification is failed` | `ondc-site-verification.html` is missing, has the wrong signature, or was signed with a different request id/key. Current workspace is missing the file. | `scripts/generate_site_verification.py`, `app/api/v1/registry.py`, deployment mount. | Generate the file with the exact `request_id` used in subscribe and the active signing private key; deploy it to repository root/container path so `/ondc-site-verification.html` returns `200`. |
| `Network participant's ondc-site-verification.html's encrypted signature verification failed` | Request id was hashed/changed, file content does not contain the raw Ed25519 signature, or signing public/private keys do not match. | `scripts/generate_site_verification.py`, `.env`. | Regenerate with `python scripts/generate_site_verification.py --request-id "<same-request-id>"`; verify `.env` signing public key matches the signing private key. |
| `OCSP failed` or `INVALID_SSL` | TLS certificate cannot be validated publicly or OCSP is unavailable. | Reverse proxy/certificate configuration; no FastAPI file. | Install a publicly trusted cert for `ondcapi.walkingtree.tech`, expose full chain, enable OCSP reachability, and retest from an external network. |
| `Encryption verification is failed` | `/ondc/on_subscribe` cannot decrypt the registry challenge. Common causes: wrong encryption private key, wrong staging registry public key, wrong public key submitted in subscribe, body not forwarded correctly. | `app/api/v1/registry.py`, `app/utils/crypto.py`, `.env`. | Confirm `ONDC_ENCRYPTION_PRIVATE_KEY_B64` matches `ONDC_ENCRYPTION_PUBLIC_KEY_B64`; confirm staging `ONDC_REGISTRY_PUBLIC_KEY_B64`; make reverse proxy preserve JSON body; retry subscribe. |
| `Please provide valid Network Participant [0] Type` | Subscribe payload has incorrect `network_participant.type` for `ops_no`. | `app/services/registry.py`, `subscribe.json`. | For buyer-app registration use `context.operation.ops_no=1` and `network_participant[0].type=buyerApp`; keep `msn=false` unless ONDC has approved otherwise. |
| `Subscriber id already exists` | Subscriber is already registered, or trying to register buyer and seller roles incorrectly. | External registry state; `app/services/registry.py` payload if changing role. | Use lookup to inspect existing record; coordinate role update with ONDC; use correct `ops_no` if registering multiple roles. |
| HTTP `404` for `/ondc/on_subscribe` | Reverse proxy path does not map to FastAPI route. | `app/api/v1/registry.py`, reverse proxy config. | Ensure public path is `https://ondcapi.walkingtree.tech/ondc/on_subscribe`; do not strip `/ondc` before forwarding. |
| HTTP `404` for `/ondc-site-verification.html` | File is not present at `ONDC_SITE_VERIFICATION_FILE`. | `app/api/v1/registry.py`, `ONDC_SITE_VERIFICATION_FILE`, Docker image/mount. | Generate `ondc-site-verification.html` before build or mount it into `/app/ondc-site-verification.html`. |
| HTTP `500` on `/health/ready` | PostgreSQL or Redis is unavailable from the API container. | `app/api/v1/health.py`, `app/db.py`, `docker-compose.yml`, `.env`. | Use Docker hostnames `db` and `redis`; run `docker compose ps`; inspect DB/Redis logs; apply migrations. |
| HTTP `401` on `/api/v1/mf/search` | Missing or wrong `X-Internal-API-Key`. | `app/core/security.py`, `.env`. | Send `X-Internal-API-Key` matching `INTERNAL_API_KEY`; do not leave `INTERNAL_API_KEY=change-me` in staging. |
| Gateway NACK: authorization/signature invalid | Outbound Authorization header digest/signature does not match the exact body sent. | `app/utils/ondc_auth.py`, `app/services/ondc_client.py`. | Validate generated header against ONDC signing utility/test vectors; ensure reverse proxy and client do not alter JSON body after signing. |
| Gateway NACK: subscriber not found | Registry lookup does not contain active `ondcapi.walkingtree.tech` for `ONDC:FIS14`. | Registry onboarding; `.env`. | Complete subscribe, confirm lookup, and ensure `ONDC_SUBSCRIBER_ID` and `ONDC_SUBSCRIBER_URI` match registry exactly. |
| Gateway NACK: invalid BAP URI | `.env` contains wrong `ONDC_SUBSCRIBER_URI`. Current sanitized check shows `https://your-domain.com/ondc`. | `.env`, `app/services/context.py`. | Set `ONDC_SUBSCRIBER_URI=https://ondcapi.walkingtree.tech/ondc` and redeploy. |
| Gateway/Workbench NACK: invalid domain | Request context domain is wrong or unsupported in target environment. | `.env`, `app/services/context.py`, `app/services/mf_mapper.py`. | Keep `ONDC_DOMAIN=ONDC:FIS14`; confirm staging gateway supports FIS14 for Mutual Funds. |
| Gateway/Workbench NACK: invalid city | City code not accepted for the selected environment or flow. | `.env`, `app/services/context.py`, request body. | Use `std:080` unless Workbench scenario specifies another city; pass scenario city through search request. |
| Gateway/Workbench NACK: invalid `core_version` | Protocol version differs from FIS/Workbench scenario. | `.env`, `app/services/context.py`. | Set `ONDC_CORE_VERSION` to the exact version required by the active Workbench/FIS14 scenario. |
| Workbench NACK: schema validation failed on `/search` | MF search payload is generic and may not include required FIS14 attributes/enums. | `app/services/mf_mapper.py`, `app/schemas/mf.py`. | Use `raw_overrides` for Workbench-required fields today; later harden mapper against the latest FIS14 Swagger examples. |
| Workbench NACK: callback signature rejected by this service | Sender key lookup fails or Workbench signature does not match public key. | `app/api/v1/callbacks.py`, `app/services/registry.py`, `app/utils/ondc_auth.py`. | Confirm Workbench sender is in staging lookup; for controlled testing set `ONDC_CALLBACK_SIGNING_PUBLIC_KEY_B64`; otherwise keep registry lookup reachable. |
| Workbench NACK: duplicate transaction/message | Same `action + direction + transaction_id + message_id` was already logged. | `app/services/transaction_log.py`, database. | Generate fresh search transaction/message ids for each test; clear test DB only when deliberately resetting a test environment. |
| Select/init/confirm cannot find BPP URI | No accepted `on_search` was logged for the transaction/provider, or callback failed signature verification. | `app/services/transaction_log.py`, `app/api/v1/mf.py`, `app/api/v1/callbacks.py`. | Wait for valid `on_search` ACK and log entry; pass `bpp_uri` explicitly for isolated smoke tests. |
| Callback returns NACK `ONDC_SIGNATURE_ERROR` | Missing/expired/invalid inbound Authorization header. | `app/api/v1/callbacks.py`, `app/utils/ondc_auth.py`. | Send signed callbacks or disable only for local isolated tests with `ONDC_VERIFY_CALLBACK_SIGNATURES=false`; keep verification enabled for staging. |
| Registry lookup returns empty | Subscribe did not complete, wrong domain/type/city, or subscriber is not active. | `app/services/registry.py`, `.env`, registry state. | Query by `subscriber_id`, `country`, `domain`, `type`, and `city`; confirm registry ACK and whitelisting. |
| Search request times out | Gateway unreachable, DNS/network blocked, or gateway did not respond in configured timeout. | `app/services/ondc_client.py`, `.env`, infrastructure firewall. | Confirm outbound HTTPS from container to `staging.gateway.proteantech.in`; increase `ONDC_REQUEST_TIMEOUT_SECONDS` only after network checks. |

## H. Final Readiness Table

| Area | Status | Blocking? | Action Required |
|---|---|---:|---|
| Code compile | Ready | No | None; compile passed. |
| Unit tests | Ready | No | Existing tests pass; add ONDC vector tests before certification. |
| Route surface | Ready | No | Verified listed routes exist. |
| Docker build/run path | Mostly ready | No | Run Docker steps and migrations on target host. |
| Public DNS/TLS | Not verified | Yes | Point `ondcapi.walkingtree.tech` to deployment and validate HTTPS/OCSP externally. |
| Site verification URL | Not ready | Yes | Generate and deploy `ondc-site-verification.html`. |
| `.env` subscriber URI | Not ready | Yes | Change `ONDC_SUBSCRIBER_URI` to `https://ondcapi.walkingtree.tech/ondc`. |
| Registry subscribe | Conditionally ready | Yes | Public HTTPS, site verification, `/on_subscribe`, keys, and whitelisting must be confirmed. |
| Registry lookup | Conditionally ready | Yes | Run signed `/v2.0/lookup` after subscribe ACK. |
| `/on_subscribe` challenge | Code ready, not externally verified | Yes | Test via registry subscribe after deployment. |
| Outbound search | Conditionally ready | No for smoke; Yes for certification | Can start after env correction and deployment; validate signing against ONDC utility. |
| Inbound callbacks | Conditionally ready | No for smoke; Yes for certification | Requires sender key lookup or configured callback public key. |
| MF payload certification | Partial | Yes for certification | Align `mf_mapper.py` payloads with current FIS14 Swagger/Workbench scenarios. |
| Workbench | Partial | No for initial smoke; Yes for pass/fail certification | Use `raw_overrides` for scenario payloads and inspect callback logs. |
| Production readiness | Not ready | Yes | Vault/KMS, observability, PII controls, rate limiting, compliance flows, and certification still required. |

## I. Final Answer

1. What is still missing?

- `ondc-site-verification.html` is not generated/deployed.
- `.env` still has `ONDC_SUBSCRIBER_URI=https://your-domain.com/ondc`; it must be `https://ondcapi.walkingtree.tech/ondc`.
- Public DNS/TLS/OCSP reachability is not verified from the internet.
- ONDC portal whitelisting and registry subscribe/lookup ACK are not yet proven.
- Authorization headers still need validation against the official ONDC signing utility/test vectors before certification.
- FIS14 Mutual Fund payloads in `app/services/mf_mapper.py` are still generic and must be matched to the active Workbench scenario or supplied through `raw_overrides`.

2. What should be done next?

- Correct `.env`.
- Generate `ondc-site-verification.html` using the exact subscribe `request_id`.
- Deploy with Docker behind HTTPS.
- Verify all public URLs.
- Submit registry `/subscribe`.
- Run signed `/v2.0/lookup`.
- Start Workbench search tests with scenario-specific `raw_overrides`.

3. Can search testing start today?

Yes, for staging smoke testing after fixing `ONDC_SUBSCRIBER_URI`, deploying the site verification file, and confirming the public `/ondc/on_search` callback is reachable. No for certification-grade Workbench completion until FIS14 payloads are aligned with the active scenario and ONDC signing is vector-validated.

4. Can registry onboarding start today?

Yes, after generating `ondc-site-verification.html`, correcting `ONDC_SUBSCRIBER_URI`, deploying public HTTPS, and confirming whitelisting. It should not be submitted before those are done because registry will NACK domain verification, callback, SSL, or subscriber checks.

5. Can deployment start today?

Yes. Docker, migrations, health checks, and route wiring are ready enough to deploy. The deployment must include corrected environment variables, generated site verification file, public DNS, and valid TLS.
