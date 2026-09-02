# GitHub Actions deploy secrets checklist

The deploy workflow needs these **repository secrets** (Settings → Secrets and variables → Actions). Use this to verify each one.

**Setting up HostGator from scratch?** Start with **[docs/HOSTGATOR-SETUP.md](docs/HOSTGATOR-SETUP.md)**.

**SSH auth failing?** See **[docs/RESET-SSH-SECRETS.md](docs/RESET-SSH-SECRETS.md)** for a full step-by-step to generate a new key and set all SSH secrets from scratch.

---

## FTP (uploads `public/build/` to the server)

| Secret | What to put | Where to get it (HostGator cPanel) |
|--------|-------------|-------------------------------------|
| **FTP_SERVER** | FTP hostname | **FTP** or **FTP Accounts** → Server/host (e.g. `ftp.yourdomain.com` or the hostname shown) |
| **FTP_USERNAME** | FTP login name | **FTP Accounts** → cPanel username or dedicated FTP user |
| **FTP_PASSWORD** | FTP password | Password for that FTP user |
| **FTP_REMOTE_DIR** | **Absolute path to the app root** (no trailing slash). Workflow uploads to `FTP_REMOTE_DIR/public/build/`. | Folder containing `artisan`, `composer.json`, and `public/`. Example: `/home/yourcpanel/public_html/DonkeySwapV2` |

**Common FTP mistake:** `FTP_REMOTE_DIR` must be the **app root** (parent of `public/`). If you set it to the `public` folder, upload goes to `public/public/build/` and the site will not see new assets.

---

## SSH (runs `git pull`, composer, migrate on the server)

| Secret | What to put | Where to get it (HostGator) |
|--------|-------------|----------------------------|
| **SSH_HOST** | Server hostname for SSH | Domain (e.g. `donkeyswapv2.example.com`) or hostname in **SSH Access** |
| **SSH_USER** | SSH login name | Usually your **cPanel username** |
| **SSH_PRIVATE_KEY** | Full **private** SSH key (`-----BEGIN ... PRIVATE KEY-----` …) | Generate a key pair; add **public** key in cPanel **SSH Access** → **Manage SSH Keys** → Import → **Authorize** |
| **SSH_PORT** | (optional) SSH port | Default `22` unless your host uses another port |
| **SERVER_APP_PATH** | **Same as FTP_REMOTE_DIR** — absolute app root | Where you cloned the repo (contains `artisan`, `public/`) |
| **PHP_BIN** | (optional) Full path to PHP 8.4 binary | Only if deploy logs say PHP not found; often `/opt/cpanel/ea-php84/root/usr/bin/php` |
| **COMPOSER_BIN** | (optional) Full path to Composer | Only if needed; often `/opt/cpanel/composer/bin/composer` |

**Important:** `SERVER_APP_PATH` and `FTP_REMOTE_DIR` should be the **same path** (the app root).

---

## Quick verification

1. **GitHub:** Repo → **Settings** → **Secrets and variables** → **Actions**. Required: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_REMOTE_DIR`, `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SERVER_APP_PATH` (optional: `SSH_PORT`, `PHP_BIN`, `COMPOSER_BIN`).
2. **FTP path:** If document root is `.../DonkeySwapV2/public`, then `FTP_REMOTE_DIR` = `/home/xxx/public_html/DonkeySwapV2` (parent of `public/`).
3. **SSH:** From your machine: `ssh -i ~/.ssh/your_deploy_key SSH_USER@SSH_HOST "cd SERVER_APP_PATH && pwd && ls -la artisan"`. If that works, the workflow can run the same commands.

---

## If FTP files still don’t update

- Confirm **FTP_REMOTE_DIR** has **no trailing slash** and points to the **app root**.
- In cPanel **File Manager**, check `public/build/` after deploy — `manifest.json` and `version.json` should be recent.
- Check the **Upload public/build via FTP** step in the Actions run log.

---

## Dependency security audits

Run periodically (e.g. before releases or monthly):

- **Composer + npm:** `composer run security-check`
- **npm only:** `npm run audit`
- **Composer only:** `composer audit`
