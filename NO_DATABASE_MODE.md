# No Database Mode

`NO_DATABASE` mode runs the ONDC FastAPI adapter without PostgreSQL, Redis, Alembic, SQLAlchemy engine creation, or transaction-log persistence.

## Environment

```env
NO_DATABASE=true
DEBUG_PRINT_PAYLOADS=true
```

Production remains unchanged:

```env
NO_DATABASE=false
DEBUG_PRINT_PAYLOADS=false
```

## Changed Files

- `app/core/config.py`: added `NO_DATABASE` and `DEBUG_PRINT_PAYLOADS` settings.
- `app/db.py`: skips SQLAlchemy engine/session initialization when `NO_DATABASE=true`; `get_db()` yields `None`.
- `app/main.py`: skips database startup initialization and table creation when `NO_DATABASE=true`.
- `app/api/v1/health.py`: skips PostgreSQL and Redis checks when `NO_DATABASE=true`; `/health/ready` returns `200`.
- `app/api/v1/callbacks.py`: accepts no-op DB dependency and prints callback Authorization headers when `DEBUG_PRINT_PAYLOADS=true`.
- `app/api/v1/mf.py`: accepts no-op DB dependency and continues outbound ONDC calls.
- `app/services/transaction_log.py`: replaces DB persistence with structured console logs when `NO_DATABASE=true`.
- `app/services/ondc_client.py`: prints outgoing payloads and Authorization headers when `DEBUG_PRINT_PAYLOADS=true`.
- `app/utils/ondc_auth.py`: prints generated signature details when `DEBUG_PRINT_PAYLOADS=true`.
- `alembic/env.py`: skips migrations when `NO_DATABASE=true`.
- `.env`: enabled local debug mode.
- `.env.example`: documented both flags with production-safe defaults.

## Run Command

PowerShell:

```powershell
$env:NO_DATABASE='true'
$env:DEBUG_PRINT_PAYLOADS='true'
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Bash:

```bash
NO_DATABASE=true DEBUG_PRINT_PAYLOADS=true uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Do not run Alembic in this mode:

```bash
# Skip this when NO_DATABASE=true
python -m alembic upgrade head
```

## Health Checks

```bash
curl -i http://localhost:8000/health/live
curl -i http://localhost:8000/health/ready
```

Expected:

```text
HTTP/1.1 200 OK
{"status":"UP"}

HTTP/1.1 200 OK
{"status":"READY","mode":"NO_DATABASE"}
```

## Sample Outbound Output

When `/api/v1/mf/search` is called:

```text
=== ONDC OUTBOUND ===
action: search
direction: outbound
status: SENT
payload:
{
  "context": {
    "action": "search",
    "bap_id": "ondcapi.walkingtree.tech"
  },
  "message": {
    "intent": {
      "descriptor": {
        "name": "mutual funds"
      }
    }
  }
}
============

=== ONDC SIGNATURE ===
created: 1780570000
expires: 1780570300
signature: <generated-signature>
============

=== ONDC OUTBOUND HTTP ===
url: https://staging.gateway.proteantech.in/search
action: search
authorization:
Signature keyId="ondcapi.walkingtree.tech|key-1|ed25519",algorithm="ed25519",created="1780570000",expires="1780570300",headers="(created)(expires)digest",signature="<generated-signature>"
headers:
{
  "Authorization": "Signature ...",
  "Content-Type": "application/json",
  "X-ONDC-Subscriber-Id": "ondcapi.walkingtree.tech"
}
payload:
{
  "context": {
    "action": "search"
  },
  "message": {
    "intent": {}
  }
}
============
```

## Sample Callback Output

When `/ondc/on_search` receives a callback:

```text
=== ONDC CALLBACK AUTHORIZATION ===
action: on_search
authorization: Signature keyId="<sender>|<key>|ed25519",algorithm="ed25519",created="1780570000",expires="1780570300",headers="(created)(expires)digest",signature="<signature>"
============

=== ONDC CALLBACK ===
action: on_search
direction: inbound
status: ACK
subscriber_id: <sender-subscriber-id>
payload:
{
  "context": {
    "action": "on_search",
    "transaction_id": "<transaction-id>"
  },
  "message": {
    "catalog": {}
  }
}
============
```

## Behavior Notes

- `save_ondc_log(...)` does not write to PostgreSQL when `NO_DATABASE=true`.
- Callback persistence is skipped when `NO_DATABASE=true`.
- Discovered BPP lookup from persisted `on_search` callbacks is unavailable in this mode.
- For `select`, `init`, `confirm`, and `status`, pass `bpp_uri` explicitly in no-database mode.
- Redis readiness checks are skipped when `NO_DATABASE=true`.
- Existing database-backed production behavior remains available by setting `NO_DATABASE=false`.
