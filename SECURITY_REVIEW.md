# Security Review

Review date: 2026-06-04  
Scope: Git preparation scan for secret-like strings before first commit.

## Summary

- Actual local secret-bearing file found: `.env`.
- `.env` is ignored by `.gitignore` and must not be committed.
- `.env.*` is also ignored, which means `.env.example` is intentionally excluded under the requested rule set.
- No application source file was modified during this review.

## Secret Scan Patterns

The repository was scanned for:

- `ONDC_SIGNING_PRIVATE_KEY`
- `ONDC_ENCRYPTION_PRIVATE_KEY`
- API key references
- password references
- token references
- secret references

## Findings

| File | Finding | Contains actual secret? | Git action | Required action |
|---|---|---:|---|---|
| `.env` | Contains configured ONDC signing private key, ONDC encryption private key, internal API key, and environment-specific values. | Yes | Ignored by `.gitignore`; must not be staged. | Keep local only or move values to deployment secret manager. |
| `.env.example` | Contains environment variable names and empty/default placeholders. | No, based on expected template usage | Ignored because requested `.env.*` rule matches it. | If a public template is needed later, add a sanitized file name not matched by `.env.*`, for example `env.example.template`. |
| `docker-compose.yml` | Contains default local Postgres password `postgres`. | No production secret, but credential-like default | Included | Replace through deployment secrets for shared/staging/prod environments. |
| `app/core/config.py` | Contains config field names and default placeholders such as empty ONDC private key fields and `change-me`. | No | Included | Acceptable for source; do not put real defaults here. |
| `app/core/security.py` | Contains internal API key validation logic and default bypass behavior when key is unset/default. | No | Included | Ensure staging/prod uses a strong `INTERNAL_API_KEY`. |
| `app/utils/ondc_auth.py` | References `ONDC_SIGNING_PRIVATE_KEY_B64` to sign outbound requests. | No | Included | Acceptable source reference. |
| `app/utils/crypto.py` | Contains cryptographic helper code and a `password=None` loader argument. | No | Included | Acceptable source reference. |
| `app/api/v1/registry.py` | References ONDC encryption private key setting for challenge decryption. | No | Included | Acceptable source reference. |
| `app/api/v1/mf.py` | References internal API key dependency. | No | Included | Acceptable source reference. |
| `scripts/generate_keys.py` | Prints generated private keys to stdout for operator copy into local secrets. | No static secret | Included | Run only in a trusted shell; do not paste output into tracked files. |
| `scripts/generate_site_verification.py` | Uses signing private key from settings to generate verification file. | No | Included | Generated `ondc-site-verification.html` is ignored. |
| `README.md` | Contains placeholder `X-Internal-API-Key: change-me`. | No | Included | Acceptable example placeholder. |
| `DEPLOYMENT_CHECKLIST.md` | Contains placeholder private key and API key names, not values. | No | Included | Acceptable operational documentation. |
| `PROJECT_AUDIT.md` | Contains secret-related setting names and security notes. | No | Included | Acceptable documentation. |
| `IMPLEMENTATION_REPORT.md` | Mentions shared-secret/decryption implementation. | No | Included | Acceptable documentation. |
| `CHANGELOG.md` | Mentions shared-secret/decryption implementation. | No | Included | Acceptable documentation. |

## Required Pre-Commit Checks

- `git check-ignore .env` must report `.env`.
- `git status --short` after staging must not show `.env` as staged.
- If `.env` appears in staged files, run:

```bash
git restore --staged .env
git check-ignore .env
git status --short
```

## Recommendation

Do not commit real ONDC private keys, internal API keys, registry credentials, tokens, database passwords, or generated site verification files. For GitHub, keep secrets in GitHub Actions secrets, deployment platform secrets, Vault, or cloud secret manager.
