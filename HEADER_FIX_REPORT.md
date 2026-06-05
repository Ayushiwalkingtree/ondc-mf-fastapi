# ONDC Authorization Header Fix Report

Fix date: 2026-06-04

## Changed File

- `app/utils/ondc_auth.py`

## Before Value

```http
headers="(created)(expires)digest"
```

## After Value

```http
headers="(created) (expires) digest"
```

## Generated Authorization Header Sample

```http
Signature keyId="ondcapi.walkingtree.tech|key-1|ed25519",algorithm="ed25519",created="1780586189",expires="1780586489",headers="(created) (expires) digest",signature="e3ndWrPVBaSNK1IT6pqd/O6fBN2oEZdGfMmgQo089rveyYF6UPJNv33hKPAxqoQf907SFE2NmvOW4YGsxufiBQ=="
```

## Debug Log Added

When `DEBUG_PRINT_PAYLOADS=true`, `app/utils/ondc_auth.py` now prints the final Authorization header after generation:

```text
authorization:
Signature keyId="...",algorithm="ed25519",created="...",expires="...",headers="(created) (expires) digest",signature="..."
============
```

## Test Results

Command:

```bash
python -m pytest -q
```

Result:

```text
2 passed in 0.41s
```

Note:

```text
pytest_asyncio emitted a deprecation warning about asyncio_default_fixture_loop_scope.
```
