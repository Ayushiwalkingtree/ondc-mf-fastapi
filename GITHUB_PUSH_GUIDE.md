# GitHub Push Guide

## Recommended Repository Name

Recommended name:

```text
ondc-mf-fastapi
```

Alternative if you want the ONDC domain in the name:

```text
ondc-fis14-mf-bap-fastapi
```

## Create Repository On GitHub

Create an empty GitHub repository without adding a README, `.gitignore`, or license from the GitHub UI.

Use:

```text
Repository name: ondc-mf-fastapi
Visibility: Private recommended until ONDC credentials, certification payloads, and deployment configuration are fully reviewed.
```

## Local Remote Setup

Replace `<OWNER>` with your GitHub username or organization.

```bash
git remote add origin https://github.com/<OWNER>/ondc-mf-fastapi.git
git branch -M main
git push -u origin main
```

SSH alternative:

```bash
git remote add origin git@github.com:<OWNER>/ondc-mf-fastapi.git
git branch -M main
git push -u origin main
```

If a remote already exists:

```bash
git remote -v
git remote set-url origin https://github.com/<OWNER>/ondc-mf-fastapi.git
git push -u origin main
```

## Authentication Troubleshooting

### HTTPS Push Fails With Password Prompt

GitHub no longer accepts account passwords for Git over HTTPS.

Fix:

```bash
git remote set-url origin https://github.com/<OWNER>/ondc-mf-fastapi.git
```

Then authenticate with a GitHub personal access token when prompted, or use GitHub CLI:

```bash
gh auth login
git push -u origin main
```

### `Permission denied (publickey)` With SSH

Check whether an SSH key is loaded:

```bash
ssh -T git@github.com
```

If it fails, add your public SSH key to GitHub:

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Then paste the public key into GitHub `Settings -> SSH and GPG keys`.

### `remote origin already exists`

Update the URL instead of adding it again:

```bash
git remote set-url origin https://github.com/<OWNER>/ondc-mf-fastapi.git
```

### Push Rejected Because Remote Has Commits

If the GitHub repository was created with files, pull first:

```bash
git pull --rebase origin main
git push -u origin main
```

If conflicts occur, resolve them locally, commit, and push again.

## Final Safety Check Before Push

Run:

```bash
git status --short
git ls-files | grep -E '(^\.env$|ondc-site-verification\.html$)'
```

Expected result:

- `git status --short` should be clean after commit.
- The `git ls-files` command should print nothing for `.env` and `ondc-site-verification.html`.

Do not push automatically from automation. Push manually after reviewing `SECURITY_REVIEW.md` and the staged file list.
