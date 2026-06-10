# ONDC Mutual Fund Buyer App Adapter - FastAPI

Production-oriented FastAPI skeleton for a buyer-side ONDC adapter for Mutual Fund discovery and transaction flows.

This repository now also includes a production-ready React + TypeScript frontend for the ONDC Mutual Fund Buyer Journey. Search uses the real backend `/search` API and a WebSocket callback stream for `/on_search` results.

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
https://ondcapi.walkingtree.tech/docs
https://ondcapi.walkingtree.tech/health/live
```

## Frontend quick start

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Production build:

```bash
npm run build
```

Frontend API and WebSocket endpoints are environment-driven:

```bash
VITE_API_BASE_URL=https://ondcapi.walkingtree.tech
VITE_WS_BASE_URL=wss://ondcapi.walkingtree.tech
```

The frontend builds API calls as `${VITE_API_BASE_URL}/api/v1/...` and WebSocket connections as `${VITE_WS_BASE_URL}/ws/ondc/{transaction_id}`. If these variables are omitted during local development, the frontend derives a local backend URL from the browser host on port `8000`.

## Frontend architecture

The React app is built with React 18, TypeScript, Vite, MUI v5, React Hook Form, Zustand, Axios, React Router, and SCSS Modules. It converts the original HTML prototype into a routed five-step buyer journey:

1. Client Onboarding
2. ONDC Catalogue Search
3. Transaction Setup
4. Review & Confirm
5. Order Tracking

The UI keeps the prototype's dark theme, left step navigation, top context header, primary content panel, sticky journey summary, selected scheme summary, and ONDC API flow panel. Pages are routed through `src/routes/AppRoutes.tsx`, while shared step metadata lives in `src/routes/steps.ts`.

## Search Flow

The catalogue search screen gives investors a category dropdown and a `Search Funds` action. It performs the callback-driven ONDC discovery flow without polling:

1. User submits `intent`, `provider_id`, and `category`.
2. Frontend calls `POST /api/v1/mf/search` with `raw_overrides: {}`.
3. Backend sends ONDC `/search` and returns `{ success: true, transaction_id }`.
4. Frontend stores the transaction ID, changes state from `SEARCHING` to `ACK_RECEIVED`, then `WAITING_FOR_ON_SEARCH`.
5. Frontend connects to `/ws/ondc/{transaction_id}`.
6. Seller `/on_search` callback reaches `POST /ondc/on_search`.
7. Backend saves the transaction log and pushes `ON_SEARCH_RECEIVED` over WebSocket.
8. Frontend parses the actual `on_search` payload and renders scheme cards.

No static schemes, hardcoded catalogue values, or polling are used for search results. Transaction IDs, WebSocket state, provider counts, category counts, fulfillment counts, and callback summaries are kept out of the normal UI and are available only through the hidden `Show Debug Info` developer panel.

## WebSocket Flow

`app/api/v1/websocket.py` exposes:

```text
/ws/ondc/{transaction_id}
```

`app/services/websocket_manager.py` keeps active in-memory connections by transaction ID and supports:

- `connect(transaction_id)`
- `disconnect(transaction_id)`
- `send_event(transaction_id, payload)`

Callbacks publish these realtime events after persistence:

- `ON_SEARCH_RECEIVED`
- `ON_SELECT_RECEIVED`
- `ON_INIT_RECEIVED`
- `ON_CONFIRM_RECEIVED`
- `ON_STATUS_RECEIVED`
- `ON_UPDATE_RECEIVED`

The frontend socket client is `src/services/ondcSocket.service.ts`. It supports `connect`, `disconnect`, `subscribe`, `unsubscribe`, status subscribers, errors, and automatic reconnect.

## Event Flow

Frontend event handling is centralized in `src/services/ondcEventHandler.ts`.

- `ON_SEARCH_RECEIVED` is parsed through `src/utils/catalogParser.ts`.
- Search catalog slices are stored in Zustand.
- Future transaction callbacks are recorded in `realtimeEvents` for later UI expansion.
- Unknown events are surfaced as errors instead of being silently ignored.

## Store Flow

Zustand state is centralized in `src/store/mfJourneyStore.ts`. It owns:

- `investorDetails`
- `searchTransactionId`
- `searchStatus`
- `websocketStatus`
- `searchStartedAt`
- `providers`
- `categories`
- `fulfillments`
- `schemes`
- `rawCatalog`
- `realtimeEvents`
- `selectedScheme`
- `selectedSchemePayload`
- `transactionDetails`
- `orderDetails`
- `currentStep`

The selected scheme payload stores `provider_id`, `scheme_item_id`, `item_id`, `fulfillment_ids`, identifiers, documents, thresholds, and category hierarchy for `/transaction-setup`.

## Component structure

The frontend components are organized under `src/components/`:

- `Layout/` composes the sidebar, header, routed page outlet, and summary column.
- `Sidebar/` provides reusable step navigation.
- `Header/` renders the current page title, subtitle, and demo-mode pill.
- `FormField/` wraps MUI fields with React Hook Form controllers.
- `SchemeCard/` renders investor-facing ONDC scheme cards from parsed `/on_search` data.
- `DeveloperPanel/` hides protocol/debug details behind a `Show Debug Info` toggle.
- `SummaryPanel/` renders journey and selected-scheme summaries.
- `ApiFlowPanel/` displays the expected ONDC call sequence.
- `Timeline/` renders reusable order tracking events.

Screens live under `src/pages/` and use SCSS Modules for page-specific layout. MUI Cards replace the prototype's custom HTML card containers.

## Future Callback Support

The realtime channel already emits all callback events. The search UI consumes `ON_SEARCH_RECEIVED` today. The same channel is ready for transaction screens to consume:

- `ON_SELECT_RECEIVED` for quote and form details.
- `ON_INIT_RECEIVED` for initialized order and payment instructions.
- `ON_CONFIRM_RECEIVED` for order acceptance.
- `ON_STATUS_RECEIVED` for status refresh.
- `ON_UPDATE_RECEIVED` for lifecycle completion, settlement, and post-order changes.

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
curl -X POST https://ondcapi.walkingtree.tech/api/v1/mf/search \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: change-me" \
  -d '{"intent":"mutual funds","provider_id":"","category":"","raw_overrides":{}}'
```

### ONDC callback example

```bash
curl -X POST https://ondcapi.walkingtree.tech/ondc/on_search \
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
