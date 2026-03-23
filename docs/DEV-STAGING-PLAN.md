# Dev/Staging Instance Plan — Test Before Going Live

This document outlines a plan to run a **development (staging) instance** of the app so you can test changes before they go to production, using the same “commit and push, GitHub does the rest” flow you have now.

---

## Goals

- **Dev instance**: A live-like site (on Bluehost) where you can test before production.
- **Same flow**: Commit → push → GitHub Actions build and deploy; no manual steps on the server.
- **Clear separation**: Dev gets updated from one branch; production only from `main`, after you’re happy with dev.

---

## Is Branching the Best Approach?

**Yes, for your case.** Here’s why:

| Approach | How it works | Pros | Cons |
|----------|--------------|------|------|
| **Branch-based (recommended)** | Push to `develop` → deploy to **dev**; merge `develop` → `main` → deploy to **prod** | Same “push = deploy” flow for both; dev is always one branch behind main until you merge; no manual “deploy to staging” click | You work on `develop` (or feature branches that merge into `develop`) and only merge to `main` when ready for prod |
| **Manual “Deploy to staging”** | Push to `main` = prod; use “Run workflow” to deploy `main` (or a ref) to dev | Single branch to maintain | Dev would be a *copy* of prod (good for smoke tests, bad for “test before going live”); or you’d deploy a branch by hand each time |
| **PR previews / ephemeral** | Each PR gets a temporary URL | Great for review | Usually needs a platform (Vercel, Netlify, or extra tooling); Bluehost isn’t built for this |

**Recommendation:** Use a **develop** branch for the dev site and **main** for production. Workflow: do work on `develop` (or feature branches → `develop`), push → dev site updates automatically; when ready for production, merge `develop` → `main` → production updates. No need to run anything on the server; GitHub handles both deploys.

---

## High-Level Architecture

```
┌─────────────────┐     push      ┌─────────────────┐     Lint + Test + Deploy (dev)     ┌─────────────────┐
│  develop branch │ ────────────► │  GitHub Actions │ ─────────────────────────────────► │  Bluehost DEV   │
└─────────────────┘               └────────┬────────┘                                    │  (e.g. dev.….)  │
                                           │                                                                  │
       merge develop → main                 │  Lint + Test + Deploy (prod)                │                  │
┌─────────────────┐     push      ┌────────┴────────┐     ─────────────────────────────► │  Bluehost PROD  │
│  main branch    │ ────────────► │  GitHub Actions │                                    │  (current site) │
└─────────────────┘               └─────────────────┘                                    └─────────────────┘
```

- **Dev site**: New Bluehost site or subdomain (e.g. `dev.yourdomain.com` or a separate domain).
- **Prod site**: Your existing Bluehost setup (unchanged).
- **Secrets**: One set for dev (e.g. `DEV_FTP_*`, `DEV_SSH_*`, `DEV_SERVER_APP_PATH`), one set for prod (existing `FTP_*`, `SSH_*`, `SERVER_APP_PATH`).

---

## What You’ll Need

### 1. A second “site” on Bluehost (dev)

You can either:

- **Subdomain (simplest):** e.g. `dev.donkeyswapv2.mikebane.com` → same Bluehost account, new subdomain, new document root and app folder.
- **Add-on or separate domain:** e.g. `staging.yourdomain.com` or a different domain on the same account.

For the dev site you will:

- Create a folder for the app (e.g. `public_html/donkey-swap-v2-dev` or `public_html/dev.donkeyswapv2.mikebane.com`).
- Set the **document root** to that folder’s `public` subfolder (same as prod).
- Create a **separate MySQL database** (e.g. `youruser_donkeyswap_dev`) and user for dev.
- Optionally use a **separate FTP account** for dev, or the same cPanel/FTP user with a different path (recommended: same FTP user, different `FTP_REMOTE_DIR`).
- Use **SSH**: same SSH user/host; only the path (`SERVER_APP_PATH`) and the repo branch (see below) differ.

### 2. Git repo on the server for the dev site

The prod server has the repo at e.g. `public_html/DonkeySwapV2` and runs `git pull origin main`. For dev you have two options:

- **Option A (recommended):** A **second clone** of the same repo in a different folder (e.g. `public_html/DonkeySwapV2-dev`). The deploy workflow for dev will SSH in and run `git pull origin develop` in that folder. So: one repo, two clones (prod on `main`, dev on `develop`).
- **Option B:** Same folder as prod but with two remotes or two branches checked out in different directories. Option A is simpler and matches “one branch = one environment.”

So on Bluehost you’ll have:

- **Prod:** e.g. `/home/youruser/public_html/DonkeySwapV2` → clone once, then always `git pull origin main`.
- **Dev:** e.g. `/home/youruser/public_html/DonkeySwapV2-dev` → clone once (from same repo), then always `git pull origin develop`.

### 3. GitHub Actions: two deploy targets

- **Current workflow:** Push to `main` → Lint + Test → Deploy to **prod** (existing secrets).
- **New behavior:**  
  - Push to **develop** → Lint + Test → Deploy to **dev** (new dev secrets).  
  - Push to **main** → Lint + Test → Deploy to **prod** (existing secrets).

So you need:

- **Dev secrets** (new): `DEV_FTP_SERVER`, `DEV_FTP_USERNAME`, `DEV_FTP_PASSWORD`, `DEV_FTP_REMOTE_DIR`, `DEV_SSH_HOST`, `DEV_SSH_USER`, `DEV_SSH_PRIVATE_KEY`, `DEV_SERVER_APP_PATH` (and optionally `DEV_SSH_PORT`).  
  - For many Bluehost setups, `DEV_FTP_*` and prod `FTP_*` can share the same server/username/password; only `DEV_FTP_REMOTE_DIR` (and `DEV_SERVER_APP_PATH`) point to the dev app folder.
- **Prod secrets** (unchanged): `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_REMOTE_DIR`, `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SERVER_APP_PATH`.

Implementation can be either:

- **Single workflow file** that runs on both `push: branches: [main, develop]`, and inside the deploy job chooses which secrets and branch to use based on `github.ref` (e.g. `main` → prod, `develop` → dev), or  
- **Two workflow files** (e.g. `deploy.yml` for prod on `main`, `deploy-dev.yml` for dev on `develop`) for clarity.  

Both are valid; a single workflow with a “matrix” or conditional deploy step keeps one place to maintain.

### 4. Server `.env` for dev

On the **dev** server folder, `.env` should point at the **dev** database and URL, and can be more relaxed for debugging:

- `APP_ENV=local` or `APP_ENV=staging`
- `APP_DEBUG=true` (optional, for easier debugging)
- `APP_URL=https://dev.yourdomain.com` (or whatever the dev URL is)
- `DB_DATABASE=youruser_donkeyswap_dev` (and same user/password for that DB)

Prod `.env` stays as now (`APP_ENV=production`, `APP_DEBUG=false`, prod DB and URL).

---

## Step-by-Step Implementation Plan

### Phase 1: Bluehost – Dev site and repo

1. Create the dev site:
   - Subdomain (e.g. `dev.donkeyswapv2.mikebane.com`) or add-on domain; set document root to `public_html/<dev-app-folder>/public`.
2. Create a **new MySQL database and user** for dev (e.g. `youruser_donkeyswap_dev`); add user to DB with full privileges.
3. In the dev app folder (e.g. `public_html/DonkeySwapV2-dev`):
   - Clone the repo: `git clone <your-repo-url> .` (or into a subfolder and point document root to its `public`).
   - Checkout and track `develop`: `git checkout -b develop origin/develop` (create `develop` on GitHub first if needed).
   - Create `.env` from `.env.example` with dev DB, `APP_URL`, `APP_ENV=staging` (or `local`), `APP_DEBUG=true` if you want.
   - Set permissions on `storage` and `bootstrap/cache`.
   - Run `composer install`, `php artisan key:generate`, `php artisan migrate --force` once (or let the first deploy do it after you’ve set secrets).

### Phase 2: GitHub – Branch and secrets

1. Create a **develop** branch (e.g. from current `main`) and push it:  
   `git checkout -b develop && git push -u origin develop`
2. Add **dev** secrets (Settings → Secrets and variables → Actions):
   - `DEV_FTP_SERVER`, `DEV_FTP_USERNAME`, `DEV_FTP_PASSWORD`, `DEV_FTP_REMOTE_DIR`
   - `DEV_SSH_HOST`, `DEV_SSH_USER`, `DEV_SSH_PRIVATE_KEY`, `DEV_SERVER_APP_PATH` (and `DEV_SSH_PORT` if not 22)

   Use the same FTP/SSH host and credentials as prod if the dev folder is on the same server; only paths differ.

### Phase 3: GitHub Actions – Deploy dev on `develop`, prod on `main`

1. Update the deploy workflow so that:
   - It runs on push to **both** `main` and `develop`.
   - **Lint** and **Test** run as they do now (same for both).
   - **Deploy** step:
     - If branch is `main`: use prod secrets and run `git pull origin main` in `SERVER_APP_PATH`.
     - If branch is `develop`: use dev secrets and run `git pull origin develop` in `DEV_SERVER_APP_PATH`.
   - FTP upload and SSH script use the chosen set of secrets and path.

2. Ensure the workflow does **not** overwrite `.env` on the server (it doesn’t today); each environment keeps its own `.env`.

### Phase 4: Day-to-day workflow

1. **Feature work:** Do work on `develop` (or on a feature branch, then merge into `develop`). Push to `develop` → GitHub runs Lint + Test and deploys to **dev**. Test on the dev URL.
2. **Release to production:** When dev looks good, merge `develop` into `main` (e.g. PR or local merge and push). Push to `main` → GitHub runs Lint + Test and deploys to **prod**. No server commands needed.

Optional: Protect `main` (e.g. require PR and/or status checks) so production only updates via intentional merges from `develop`.

---

## Summary Table

| Item | Production (current) | Dev (new) |
|------|----------------------|-----------|
| **Branch** | `main` | `develop` |
| **Trigger** | Push to `main` | Push to `develop` |
| **Bluehost** | Existing site + folder | New subdomain/site + new folder + new DB |
| **Secrets** | `FTP_*`, `SSH_*`, `SERVER_APP_PATH` | `DEV_FTP_*`, `DEV_SSH_*`, `DEV_SERVER_APP_PATH` |
| **Server path** | e.g. `.../DonkeySwapV2` | e.g. `.../DonkeySwapV2-dev` |
| **Git on server** | `git pull origin main` | `git pull origin develop` |
| **.env** | `APP_ENV=production`, prod DB/URL | `APP_ENV=staging`, dev DB/URL |

---

## Optional: One workflow file vs two

- **One workflow (`deploy.yml`):**  
  - `on.push.branches: [main, develop]`  
  - In the deploy job, use `github.ref == 'refs/heads/main'` to pick prod vs dev secrets and branch name.  
  - Single place to change lint/test/deploy logic; slightly more logic in the workflow.

- **Two workflows:**  
  - `deploy.yml`: `on.push.branches: [main]` → prod secrets, `main`.  
  - `deploy-dev.yml`: `on.push.branches: [develop]` → dev secrets, `develop`.  
  - Clear separation; duplicate job definitions unless you use a reusable workflow.

Recommendation: start with **one workflow** that runs on `[main, develop]` and branches inside the deploy step by `github.ref`; you can split into two files later if you prefer.

---

## Next Steps

1. Create the `develop` branch and push it.
2. On Bluehost: create dev subdomain/site, folder, DB, and second clone; configure document root and `.env`.
3. Add dev secrets in GitHub.
4. Update `.github/workflows/deploy.yml` to run on `develop` and deploy to dev using dev secrets and `git pull origin develop` in the dev path.
5. Test: push a small change to `develop`, confirm dev site updates; merge to `main`, confirm prod updates.

If you want, the next concrete step can be a patch for `deploy.yml` that implements the “deploy to dev on `develop`, prod on `main`” logic with the secret names above.
