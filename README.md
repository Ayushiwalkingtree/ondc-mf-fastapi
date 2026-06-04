# ONDC Mutual Fund Buyer App Adapter - FastAPI

Production-oriented FastAPI skeleton for a buyer-side ONDC adapter for Mutual Fund discovery and transaction flows.

> Important: ONDC FIS Mutual Fund payload attributes evolve. This project implements the infrastructure, security, request/response lifecycle, persistence, error handling, logging, and extensible payload mappers. Replace/extend `app/services/mf_mapper.py` according to the latest ONDC FIS Mutual Fund Swagger/Workbench examples before certification.

## What this project includes

- FastAPI application structure
- Health/readiness APIs
- Registry `/on_subscribe` callback
- Site verification HTML generation helper
- ONDC context builder
- Beckn/ONDC request signing helper
- Signature verification helper
- Registry lookup client
- Gateway client
- Mutual Fund buyer flows:
  - `/search` outbound
  - `/on_search` callback
  - `/select` outbound
  - `/on_select` callback
  - `/init` outbound
  - `/on_init` callback
  - `/confirm` outbound
  - `/on_confirm` callback
  - `/status` outbound
  - `/on_status` callback
- PostgreSQL persistence using SQLAlchemy async
- Structured JSON logs with request correlation ID
- Global error handling
- Docker Compose with API, PostgreSQL, Redis
- Tests

## Quick start

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python scripts/generate_keys.py
# copy generated keys to .env
uvicorn app.main:app --reload --port 8000
```

Open:

```text
http://localhost:8000/docs
http://localhost:8000/health/live
```

## Docker

```bash
docker compose up --build
```

## Key generation

```bash
python scripts/generate_keys.py
```

The script generates:

- Ed25519 signing public/private keys
- X25519 encryption public/private keys

## Site verification

```bash
python scripts/generate_site_verification.py --request-id YOUR_UNIQUE_REQUEST_ID --out ./ondc-site-verification.html
```

Host the generated file at:

```text
https://<subscriber_id>/ondc-site-verification.html
```

## ONDC onboarding steps supported here

1. Generate keys
2. Configure `.env`
3. Host `ondc-site-verification.html`
4. Expose `/ondc/on_subscribe`
5. Configure callback URL with ONDC registry/portal
6. Build/test Mutual Fund buyer flows in staging/workbench

## API examples

### Search schemes

```bash
curl -X POST http://localhost:8000/api/v1/mf/search \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: change-me" \
  -d '{"intent":"equity mutual funds","city":"std:080"}'
```

### ONDC callback example

```bash
curl -X POST http://localhost:8000/ondc/on_search \
  -H "Content-Type: application/json" \
  -d '{"context":{"transaction_id":"t1","message_id":"m1"},"message":{"catalog":{"providers":[]}}}'
```

## Production notes

- Put this service behind Kong/Nginx/API Gateway.
- Enforce TLS 1.2+.
- Store private keys in a vault, not `.env`.
- Persist full ONDC request and response payloads for audit.
- Add idempotency checks on `transaction_id + message_id + action`.
- Add mutual fund compliance modules separately: KYC, bank validation, ARN/EUIN, consent, suitability/risk disclosure, payment/mandate, reconciliation, IGM.
