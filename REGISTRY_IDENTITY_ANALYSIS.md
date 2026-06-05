# Registry Identity Analysis

Analysis date: 2026-06-04

## Current Portal Facts

```text
Subscriber ID = ondcapi.walkingtree.tech
Unique Key ID = cbbb99f5-ec6c-4ab6-bac6-3b6114c41664
Registry Domain / Role label = Buyer NP
```

## Current Local Configuration

From active settings:

```text
ONDC_SUBSCRIBER_ID=ondcapi.walkingtree.tech
ONDC_SUBSCRIBER_URI=https://ondcapi.walkingtree.tech/ondc
ONDC_UNIQUE_KEY_ID=cbbb99f5-ec6c-4ab6-bac6-3b6114c41664
ONDC_DOMAIN=ONDC:FIS14
ONDC_COUNTRY=IND
ONDC_CITY=std:080
ONDC_LOOKUP_TYPE=BAP
ONDC_REGISTRY_SUBSCRIBER_TYPE=buyerApp
ONDC_REGISTRY_URL=https://staging.registry.ondc.org
ONDC_CALLBACK_URL=/ondc
```

Important finding:

```text
The local unique key id now matches the portal unique key id.
```

## Exact Lookup Payload Currently Sent

`app/services/registry.py:70-79` builds lookup payloads using:

```python
payload = {
    'domain': domain or self.settings.ONDC_DOMAIN,
    'country': self.settings.ONDC_COUNTRY,
    'type': lookup_type or self.settings.ONDC_LOOKUP_TYPE,
}
```

Current lookup payload:

```json
{
  "city": "std:080",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "subscriber_id": "ondcapi.walkingtree.tech",
  "type": "BAP"
}
```

Endpoint:

```text
https://staging.registry.ondc.org/v2.0/lookup
```

## Exact Subscribe Payload Currently Generated

`app/services/registry.py:28-55` currently generates:

```json
{
  "context": {
    "operation": {
      "ops_no": 1
    }
  },
  "message": {
    "entity": {
      "callback_url": "/ondc/on_subscribe",
      "key_pair": {
        "encryption_public_key": "MCowBQYDK2VuAyEAWiypL9endiKsUGVozSBzYZRrvzy2X5g/6O1hiFGQGhA=",
        "signing_public_key": "OnKbhilkZkawA4dDVYV/j+6SRlsvMGWynjuoE7mRZa4=",
        "valid_from": "2026-06-04T15:36:16Z",
        "valid_until": "2027-06-04T15:36:16Z"
      },
      "subscriber_id": "ondcapi.walkingtree.tech",
      "unique_key_id": "cbbb99f5-ec6c-4ab6-bac6-3b6114c41664"
    },
    "network_participant": [
      {
        "city_code": [
          "std:080"
        ],
        "domain": "ONDC:FIS14",
        "msn": false,
        "subscriber_url": "/ondc",
        "type": "buyerApp"
      }
    ],
    "request_id": "analysis-request-id",
    "timestamp": "2026-06-04T15:36:16Z"
  }
}
```

## Type / Domain / City Comparison

| Concept | Portal says | Current code/config | Meaning | Status |
|---|---|---|---|---|
| Subscriber ID | `ondcapi.walkingtree.tech` | `ondcapi.walkingtree.tech` | Network identity / domain name | Match |
| Unique Key ID | `cbbb99f5-ec6c-4ab6-bac6-3b6114c41664` | `cbbb99f5-ec6c-4ab6-bac6-3b6114c41664` | Authorization `keyId` middle segment | Match |
| Portal role label | `Buyer NP` | `buyerApp` for subscribe | Portal UI label maps to buyer-app participant role | OK |
| Subscribe NP type | Buyer NP equivalent | `buyerApp` | Registry subscribe `network_participant.type` | OK |
| Lookup type | Buyer NP equivalent | `BAP` | Lookup filter / protocol role | Possible mismatch |
| ONDC protocol domain | Not the same as Buyer NP | `ONDC:FIS14` | Business/protocol domain for Mutual Funds | OK |
| City | Must match subscribed city | `std:080` | Registry participant city code | Needs portal confirmation |

## Are `BAP`, `buyerApp`, And `Buyer NP` Mixed Incorrectly?

They are three different labels for related but different layers:

```text
Buyer NP = portal/business role label
buyerApp = registry subscribe participant type
BAP = protocol role / older registry lookup type
```

What is currently mixed:

```text
Subscribe uses buyerApp.
Lookup uses BAP.
Portal displays Buyer NP.
```

This is not necessarily wrong for older ONDC terminology, but it is risky for `/v2.0/lookup`. For current registry v2 flows, `buyerApp` is the safer lookup type to test because it matches the subscribed network participant type.

Important:

```text
Do not set ONDC_DOMAIN=Buyer NP.
ONDC_DOMAIN must remain ONDC:FIS14 for Mutual Funds.
```

## All Lookup Requests Generated

### 1. BAP

```json
{
  "city": "std:080",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "subscriber_id": "ondcapi.walkingtree.tech",
  "type": "BAP"
}
```

### 2. buyerApp

```json
{
  "city": "std:080",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "subscriber_id": "ondcapi.walkingtree.tech",
  "type": "buyerApp"
}
```

### 3. Buyer NP Portal Label

```json
{
  "city": "std:080",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "subscriber_id": "ondcapi.walkingtree.tech",
  "type": "Buyer NP"
}
```

### 4. buyerNp Variant

```json
{
  "city": "std:080",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "subscriber_id": "ondcapi.walkingtree.tech",
  "type": "buyerNp"
}
```

### 5. buyerNP Variant

```json
{
  "city": "std:080",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "subscriber_id": "ondcapi.walkingtree.tech",
  "type": "buyerNP"
}
```

## Lookup Variant Results

The following signed lookup variants were tested against:

```text
https://staging.registry.ondc.org/v2.0/lookup
```

| Lookup type | Result |
|---|---|
| `BAP` | `401 {"code":"1000","message":"Subscriber not found"}` |
| `buyerApp` | `401 {"code":"1000","message":"Subscriber not found"}` |
| `Buyer NP` | `401 {"code":"1000","message":"Subscriber not found"}` |
| `buyerNp` | `401 {"code":"1000","message":"Subscriber not found"}` |
| `buyerNP` | `401 {"code":"1000","message":"Subscriber not found"}` |

Additional lookup shapes also returned `Subscriber not found`:

| Lookup shape | Result |
|---|---|
| `{"country":"IND","domain":"ONDC:FIS14"}` | `Subscriber not found` |
| `subscriber_id + domain only` | `Subscriber not found` |
| `subscriber_id + BAP without city` | `Subscriber not found` |
| `subscriber_id + buyerApp without city` | `Subscriber not found` |
| `subscriber_id + city without type` | `Subscriber not found` |
| `domain="Buyer NP"` | `Subscriber not found` |

Interpretation:

```text
This is not only a BAP-vs-buyerApp filter issue. The registry/gateway is not recognizing the authenticated subscriber identity itself, or the portal subscription is not present in this staging registry/domain.
```

## Exact Mismatch

Hard mismatch found:

```text
Current code lookup type is BAP while subscribe participant type is buyerApp and portal role label is Buyer NP.
```

However, because `buyerApp` lookup also returns `Subscriber not found`, this mismatch is not sufficient by itself to explain the failure.

Most likely operational mismatch:

```text
Portal shows Subscribed, but https://staging.registry.ondc.org/v2.0/lookup does not contain or trust ondcapi.walkingtree.tech for ONDC:FIS14.
```

That can happen when:

- Portal subscription is for another environment, not staging.
- Portal subscription is for another domain/category, not `ONDC:FIS14`.
- Portal role is subscribed, but FIS14 registry/domain whitelisting has not propagated.
- Gateway/registry cache still has an older key or no key for this subscriber.
- Subscribe challenge/domain verification did not complete for the current key id.

## Exact `.env` Values Required

Required for the current portal facts:

```env
ONDC_SUBSCRIBER_ID=ondcapi.walkingtree.tech
ONDC_SUBSCRIBER_URI=https://ondcapi.walkingtree.tech/ondc
ONDC_UNIQUE_KEY_ID=cbbb99f5-ec6c-4ab6-bac6-3b6114c41664
ONDC_DOMAIN=ONDC:FIS14
ONDC_COUNTRY=IND
ONDC_CITY=std:080
ONDC_CALLBACK_URL=/ondc
ONDC_REGISTRY_URL=https://staging.registry.ondc.org
ONDC_REGISTRY_SUBSCRIBER_TYPE=buyerApp
ONDC_LOOKUP_TYPE=buyerApp
ONDC_GATEWAY_SEARCH_URL=https://staging.gateway.proteantech.in/search
```

Notes:

- `ONDC_LOOKUP_TYPE=buyerApp` is recommended for `/v2.0/lookup` testing because it matches `network_participant.type`.
- If ONDC/Protean explicitly instructs older Beckn role values for this endpoint, use `ONDC_LOOKUP_TYPE=BAP`.
- Do not use `Buyer NP` as `ONDC_DOMAIN`.
- Do not use `Buyer NP` as `ONDC_REGISTRY_SUBSCRIBER_TYPE`; use `buyerApp`.

## Exact Lookup Request That Should Succeed

After the subscriber is actually present in the same staging registry and FIS14 domain, this should succeed:

```json
{
  "subscriber_id": "ondcapi.walkingtree.tech",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "type": "buyerApp",
  "city": "std:080"
}
```

If ONDC/Protean confirms the lookup endpoint expects protocol role names, this alternate should succeed:

```json
{
  "subscriber_id": "ondcapi.walkingtree.tech",
  "country": "IND",
  "domain": "ONDC:FIS14",
  "type": "BAP",
  "city": "std:080"
}
```

Minimum diagnostic request:

```json
{
  "subscriber_id": "ondcapi.walkingtree.tech",
  "country": "IND",
  "domain": "ONDC:FIS14"
}
```

Because even the minimum diagnostic request returns `Subscriber not found`, the primary issue is likely registry presence/environment/whitelisting rather than lookup filter alone.

## Commands To Reproduce

Print current lookup payload:

```powershell
python -c "import json; from app.services.registry import RegistryClient; c=RegistryClient(); p={'domain': c.settings.ONDC_DOMAIN, 'country': c.settings.ONDC_COUNTRY, 'type': c.settings.ONDC_LOOKUP_TYPE, 'subscriber_id': c.settings.ONDC_SUBSCRIBER_ID, 'city': c.settings.ONDC_CITY}; print(json.dumps(p, indent=2, sort_keys=True))"
```

Print current subscribe payload:

```powershell
python -c "import json; from app.services.registry import RegistryClient; print(json.dumps(RegistryClient().build_subscribe_payload(request_id='analysis-request-id'), indent=2, sort_keys=True))"
```

Test lookup types:

```powershell
$env:DEBUG_PRINT_PAYLOADS='false'
python -c "exec('import asyncio\nfrom app.services.registry import RegistryClient\nasync def one(t):\n    try:\n        r = await RegistryClient().lookup_subscriber(\"ondcapi.walkingtree.tech\", lookup_type=t, city=\"std:080\")\n        print(t, r)\n    except Exception as exc:\n        print(t, type(exc).__name__, str(exc))\nasync def main():\n    for t in [\"BAP\", \"buyerApp\", \"Buyer NP\", \"buyerNp\", \"buyerNP\"]:\n        await one(t)\nasyncio.run(main())')"
```

## Probability Scores

| Probability | Root cause | Evidence | Next validation |
|---:|---|---|---|
| 80% | Portal subscription is not present in the same staging registry endpoint used by the app. | All lookup variants return `Subscriber not found` from `https://staging.registry.ondc.org/v2.0/lookup`. | Ask ONDC/Protean to confirm `ondcapi.walkingtree.tech` exists in staging registry for FIS14. |
| 70% | FIS14 domain entitlement/whitelisting is not enabled or not propagated. | Portal role says Buyer NP, but registry lookup for `ONDC:FIS14` returns nothing. | Confirm FIS14 Mutual Fund staging access is approved for this subscriber. |
| 65% | Gateway/registry cache has no active key for the current `unique_key_id`. | Authentication failed after header parser fix; lookup auth also returns subscriber not found. | Ask ONDC/Protean to confirm active key id `cbbb99f5-ec6c-4ab6-bac6-3b6114c41664` and public key fingerprint. |
| 45% | `BAP` vs `buyerApp` lookup type mismatch. | Code uses `BAP`, subscribe uses `buyerApp`; but `buyerApp` also failed. | Set/test `ONDC_LOOKUP_TYPE=buyerApp` after registry sync. |
| 35% | City mismatch. | Current city is `std:080`; portal may have another city/all-India setting. | Confirm portal city list includes `std:080`; test without city after registry sync. |
| 25% | Wrong registry environment URL. | Portal may show subscribed in another environment while code uses staging. | Confirm portal environment exactly maps to `https://staging.registry.ondc.org`. |
| 10% | `Buyer NP` used as protocol domain. | Code correctly uses `ONDC:FIS14`, and `Buyer NP` as domain also failed. | Do not change `ONDC_DOMAIN` to `Buyer NP`. |

## Final Conclusion

There is one local semantic mismatch:

```text
lookup type = BAP
subscribe network participant type = buyerApp
portal role label = Buyer NP
```

But this is not the full explanation, because every lookup variant, including `buyerApp`, still returns `Subscriber not found`.

The strongest conclusion is:

```text
The portal subscription is not visible to the staging registry/gateway identity path being used by this app, or the FIS14 buyer-app entitlement/key has not propagated.
```

Most useful next request to ONDC/Protean:

```text
Please confirm that subscriber_id ondcapi.walkingtree.tech is active in staging registry for ONDC:FIS14 as buyerApp/BAP, city std:080, unique_key_id cbbb99f5-ec6c-4ab6-bac6-3b6114c41664, signing public key OnKbhilkZkawA4dDVYV/j+6SRlsvMGWynjuoE7mRZa4=.
```
