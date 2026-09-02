# HostGator setup — fresh install + GitHub Actions deploy

Use this when moving DonkeySwap V2 to **HostGator** and wiring up **FTP + SSH** deploy from GitHub Actions (push to `main`).

HostGator uses **cPanel**, same pattern as Bluehost. The workflow uploads built frontend assets via **FTP**, then **SSH** runs `git pull`, `composer install`, and `migrate`.

---

## Overview

| Piece | What it does |
|-------|----------------|
| **Git clone on server** | App code lives in e.g. `~/public_html/DonkeySwapV2` |
| **Document root** | Points at `.../DonkeySwapV2/public` (Laravel `public/`) |
| **MySQL** | Fresh database for production |
| **`.env` on server** | Secrets and DB credentials (never in Git) |
| **GitHub Actions secrets** | FTP + SSH so CI can deploy on push to `main` |

---

## Part 1 — HostGator one-time server setup

### 1.1 Enable SSH

1. Log in to **HostGator** → **cPanel**.
2. **Security** → **SSH Access**.
3. Enable shell access if it is off.
4. Note:
   - **SSH host** — often your domain (e.g. `donkeyswapv2.example.com`) or the server hostname shown in cPanel.
   - **SSH user** — your **cPanel username**.

### 1.2 Clone the repository

**Option A — cPanel Git (easiest)**

1. **Files** → **Git™ Version Control** → **Create**.
2. **Clone URL:** `https://github.com/MikeBane57/DonkeySwapV2.git`
3. **Repository path:** e.g. `public_html/DonkeySwapV2`
4. Branch: `main`
5. Create and wait for the clone to finish.

**Option B — Terminal**

```bash
cd ~/public_html
git clone https://github.com/MikeBane57/DonkeySwapV2.git
cd DonkeySwapV2
```

**Find your app root:** the folder that contains `artisan`, `composer.json`, and `public/`.  
Example: `/home/yourcpanel/public_html/DonkeySwapV2` — this path is **`SERVER_APP_PATH`** and **`FTP_REMOTE_DIR`**.

### 1.3 Set document root

1. cPanel → **Domains** → your domain → **Manage**.
2. Set **Document Root** to the Laravel `public` folder, e.g.:
   - `public_html/DonkeySwapV2/public`
3. Save.

### 1.4 PHP version

1. cPanel → **MultiPHP Manager** (or **Select PHP Version**).
2. Set the domain to **PHP 8.4** (minimum 8.2; CI uses 8.4).

### 1.5 Create MySQL database

1. cPanel → **MySQL® Databases**.
2. Create a database (e.g. `youruser_donkeyswap`).
3. Create a user with a strong password.
4. **Add user to database** with **ALL PRIVILEGES**.
5. Note: database name, username, password, host (usually `localhost`).

### 1.6 Create `.env` on the server

In **File Manager**, in the app root:

1. Copy `.env.example` → `.env`.
2. Edit `.env` (minimum):

```env
APP_NAME="Donkey Swap"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

APP_KEY=base64:...   # generate locally: php artisan key:generate --show

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=youruser_donkeyswap
DB_USERNAME=youruser_swapuser
DB_PASSWORD=your-strong-password

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=database
```

3. For push notifications later, add `VAPID_*` keys (`php artisan webpush:vapid`).

### 1.7 Permissions and first-time install

In cPanel **Terminal** (or SSH):

```bash
cd ~/public_html/DonkeySwapV2   # your app root

# Writable dirs
chmod -R ug+rwx storage bootstrap/cache

# PHP + Composer (HostGator cPanel paths)
source deploy/cpanel-detect-php.sh
$PHP $COMPOSER install --no-dev --optimize-autoloader --no-interaction
$PHP artisan storage:link
$PHP artisan migrate --force
$PHP artisan optimize
```

You do **not** need `npm run build` on the server for normal deploys — GitHub Actions uploads `public/build/` via FTP.

### 1.8 Smoke test

Open `https://your-domain.com`. You should see the app (login page).  
If you get 500 errors, check `storage/logs/laravel.log` and that `APP_KEY` and DB settings are correct.

---

## Part 2 — SSH key for GitHub Actions

GitHub Actions must SSH in as your cPanel user to run `git pull` and migrations.

### 2.1 Generate a deploy key (on your PC)

**PowerShell:**

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\donkeyswapv2_deploy" -C "github-actions-deploy" -N '""'
```

**macOS / Linux:**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/donkeyswapv2_deploy -C "github-actions-deploy" -N ""
```

### 2.2 Add the **public** key to HostGator

1. Show the public key and copy the full line:

   ```powershell
   Get-Content "$env:USERPROFILE\.ssh\donkeyswapv2_deploy.pub"
   ```

2. HostGator cPanel → **SSH Access** → **Manage SSH Keys** → **Import**.
3. Paste the public key, save, then **Authorize** the key (required).

### 2.3 Test SSH from your PC

```powershell
ssh -i "$env:USERPROFILE\.ssh\donkeyswapv2_deploy" YOUR_CPANEL_USER@YOUR_SSH_HOST "cd /home/YOUR_CPANEL_USER/public_html/DonkeySwapV2 && pwd && ls artisan"
```

Replace paths and user with your values. If this works, GitHub Actions will work too.

---

## Part 3 — GitHub Actions secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Use the same values for **`FTP_REMOTE_DIR`** and **`SERVER_APP_PATH`** (app root, **no trailing slash**).

| Secret | Example / notes |
|--------|------------------|
| `FTP_SERVER` | FTP hostname from cPanel → **FTP Accounts** (e.g. `ftp.yourdomain.com` or server hostname) |
| `FTP_USERNAME` | cPanel username or dedicated FTP user |
| `FTP_PASSWORD` | That user's password |
| `FTP_REMOTE_DIR` | `/home/yourcpanel/public_html/DonkeySwapV2` |
| `SSH_HOST` | SSH hostname (domain or server name, no `https://`) |
| `SSH_USER` | cPanel username |
| `SSH_PRIVATE_KEY` | Full private key file (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END …`) |
| `SERVER_APP_PATH` | Same as `FTP_REMOTE_DIR` |
| `SSH_PORT` | Optional; default `22` |
| `PHP_BIN` | Optional; only if auto-detect fails (e.g. `/opt/cpanel/ea-php84/root/usr/bin/php`) |
| `COMPOSER_BIN` | Optional; only if auto-detect fails |

**FTP path rule:** secrets point at the **app root** (parent of `public/`), not `public/` itself. The workflow uploads to `FTP_REMOTE_DIR/public/build/`.

See also **[SECRETS-CHECKLIST.md](../SECRETS-CHECKLIST.md)** and **[RESET-SSH-SECRETS.md](RESET-SSH-SECRETS.md)**.

---

## Part 4 — First deploy from GitHub

1. Confirm all secrets above are set.
2. Push to `main` (or **Actions** → **CI** → **Run workflow** on `main`).
3. Watch the run:
   - **Lint and test** — must pass.
   - **Upload assets and deploy** — FTP upload + SSH `git pull` / composer / migrate.

4. Verify deploy:

   - `https://your-domain.com/build/version.json` — should show a recent commit SHA.
   - Hard refresh the site (Ctrl+F5) if UI looks cached.

### If deploy fails

| Symptom | Fix |
|---------|-----|
| Missing secrets | Add the secret named in the error |
| FTP upload wrong path | `FTP_REMOTE_DIR` must be app root; check `public/build/` on server in File Manager |
| SSH auth failed | Re-import and **authorize** public key; check `SSH_PRIVATE_KEY` has full key |
| `git pull` fails | Ensure server clone exists and is on `main`; for private repo, set up deploy token or SSH deploy key on server |
| PHP/composer not found | Set `PHP_BIN` / `COMPOSER_BIN` secrets; enable PHP 8.4 in MultiPHP Manager |
| 500 after deploy | Check `.env`, `storage` permissions, `storage/logs/laravel.log` |

---

## Part 5 — Manual deploy (optional)

If you need to deploy without pushing:

```bash
cd ~/public_html/DonkeySwapV2
./deploy/server-deploy.sh
```

Or run **Actions** → **Production sync** (manual workflow) after secrets are set.

---

## Quick checklist

| Step | Done |
|------|------|
| SSH enabled on HostGator | ☐ |
| Repo cloned to e.g. `public_html/DonkeySwapV2` | ☐ |
| Document root → `.../DonkeySwapV2/public` | ☐ |
| PHP 8.4+ selected | ☐ |
| MySQL database + user created | ☐ |
| `.env` on server (APP_KEY, DB_*, APP_URL) | ☐ |
| `storage` + `bootstrap/cache` writable | ☐ |
| First-time `composer install` + `migrate` on server | ☐ |
| SSH deploy key imported + **authorized** | ☐ |
| All GitHub Actions secrets set | ☐ |
| Push to `main` → CI deploy green | ☐ |
| `build/version.json` shows latest commit | ☐ |

---

## What you do **not** need on the server

- Full Git history backup from Bluehost (starting fresh).
- `npm` / Node for routine deploys (CI builds and FTPs `public/build/`).
- Code upload by hand — `git pull` on the server + FTP for built assets handles it.
