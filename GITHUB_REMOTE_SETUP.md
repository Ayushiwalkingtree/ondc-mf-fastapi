# GitHub Remote Setup

Setup date: 2026-06-04  
Repository URL: `https://github.com/Ayushiwalkingtree/ondc-mf-fastapi.git`  
Local branch: `main`

## Current Remote Commands Used

Remote add command:

```bash
git remote add origin https://github.com/Ayushiwalkingtree/ondc-mf-fastapi.git
```

Remote verify command:

```bash
git remote -v
```

Branch rename command:

```bash
git branch -M main
```

Connectivity check command:

```bash
git ls-remote origin
```

Result observed:

```text
remote: Repository not found.
fatal: repository 'https://github.com/Ayushiwalkingtree/ondc-mf-fastapi.git/' not found
```

This means the local Git remote is configured, but GitHub did not expose the repository to the current Git credentials/session.

## Manual Push Command

Do not run this until the GitHub repository exists and your GitHub account has access:

```bash
git push -u origin main
```

## Exact Commands To Run Manually

If the GitHub repository does not exist yet, create it first in GitHub:

```text
Owner: Ayushiwalkingtree
Repository name: ondc-mf-fastapi
Visibility: Private recommended
Initialize with README: No
Add .gitignore: No
Add license: No
```

Then run:

```bash
git remote -v
git branch --show-current
git ls-remote origin
git push -u origin main
```

If `origin` must be corrected:

```bash
git remote set-url origin https://github.com/Ayushiwalkingtree/ondc-mf-fastapi.git
git remote -v
git ls-remote origin
git push -u origin main
```

## Troubleshooting

### Repository Not Found

Cause:

- The GitHub repository has not been created.
- The owner or repository name is wrong.
- The repository is private and the current Git credentials do not have access.

Fix:

```bash
git remote -v
git remote set-url origin https://github.com/Ayushiwalkingtree/ondc-mf-fastapi.git
git ls-remote origin
```

Also confirm in GitHub that `Ayushiwalkingtree/ondc-mf-fastapi` exists and that your account has access.

### Authentication Failed

Cause:

- GitHub account password was used instead of a token.
- Stored Git credentials are expired or belong to the wrong account.

Fix with GitHub CLI:

```bash
gh auth login
git push -u origin main
```

Fix with HTTPS token:

```bash
git credential-manager erase https://github.com
git push -u origin main
```

When prompted, use your GitHub username and a personal access token with repository access.

### Permission Denied

Cause:

- Your GitHub user does not have write permission to `Ayushiwalkingtree/ondc-mf-fastapi`.
- The remote URL points to a repository owned by another account or organization.

Fix:

```bash
git remote -v
git remote set-url origin https://github.com/Ayushiwalkingtree/ondc-mf-fastapi.git
git push -u origin main
```

If it still fails, add your GitHub account as a collaborator or push to a repository under your own account.

### Branch Protection

Cause:

- GitHub branch protection blocks direct push to `main`.

Fix:

```bash
git checkout -b initial-import
git push -u origin initial-import
```

Then open a pull request from `initial-import` to `main` in GitHub.

## Final Safety Check

Before pushing, confirm no ignored secrets are tracked:

```bash
git status --short
git ls-files .env ondc-site-verification.html
```

Expected:

- `git ls-files .env ondc-site-verification.html` prints nothing.
- `git status --short` may show `GITHUB_REMOTE_SETUP.md` until it is committed.
