# GitHub Actions deploy secrets checklist

The deploy workflow needs these **repository secrets** (Settings → Secrets and variables → Actions). Use this to verify each one.

---

## FTP (used to upload `public/build/` to the server)

| Secret | What to put | Where to get it (Bluehost cPanel) |
|--------|-------------|-----------------------------------|
| **FTP_SERVER** | FTP hostname | **FTP** or **FTP Accounts** → Server/host (e.g. `ftp.donkeyswapv2.mikebane.com` or the hostname shown; sometimes same as domain) |
| **FTP_USERNAME** | FTP login name | **FTP Accounts** → the username you use to log in via FTP (often your cPanel username or a dedicated FTP user) |
| **FTP_PASSWORD** | FTP password | The password for that FTP user |
| **FTP_REMOTE_DIR** | **Absolute path to the app root on the server** (no trailing slash). The workflow uploads into `FTP_REMOTE_DIR/public/build/`. | Where the app lives. Examples: `/home/yourcpanel/public_html/DonkeySwapV2` or `/public_html/donkeyswapv2`. **Not** the `public` folder—the folder that contains `artisan`, `composer.json`, and the `public` directory. |

**Common FTP mistake:** `FTP_REMOTE_DIR` must be the **app root** (parent of `public/`). If you set it to the `public` folder, the upload would go to `public/public/build/` and the site would not see the new files.

---

## SSH (used to run `git pull`, composer, migrate on the server)

| Secret | What to put | Where to get it (Bluehost) |
|--------|-------------|----------------------------|
| **SSH_HOST** | Server hostname for SSH | Often the same as your domain (e.g. `donkeyswapv2.mikebane.com`) or the hostname shown in **SSH Access** in cPanel. |
| **SSH_USER** | SSH login name | Usually your **cPanel username**. |
| **SSH_PRIVATE_KEY** | Full contents of the **private** SSH key (starts with `-----BEGIN ... PRIVATE KEY-----`). | Generate a key pair; add the **public** key in cPanel **SSH Access** → **Manage SSH Keys** → Import; paste the **private** key into this secret. No passphrase is easiest for automation. |
| **SSH_PORT** | (optional) SSH port | Default 22. Only set if your host uses a different port. |
| **SERVER_APP_PATH** | **Same as FTP_REMOTE_DIR**—absolute path to the app root on the server. | The folder where you ran `git clone` or where cPanel Git put the repo (contains `artisan`, `composer.json`, `public/`). The workflow runs `cd SERVER_APP_PATH` then `git pull`, so this must be the repo root. |

**Important:** `SERVER_APP_PATH` and `FTP_REMOTE_DIR` should be the **same path** (the app root). Example: `/home/youruser/public_html/DonkeySwapV2`.

---

## Quick verification

1. **GitHub:** Repo → **Settings** → **Secrets and variables** → **Actions**. You should see: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_REMOTE_DIR`, `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SERVER_APP_PATH` (and optionally `SSH_PORT`).
2. **FTP path:** If your site is at `https://donkeyswapv2.mikebane.com` and the document root is set to `.../public`, then the app root is the parent of that `public` folder. `FTP_REMOTE_DIR` and `SERVER_APP_PATH` = that parent path (e.g. `/home/xxx/public_html/DonkeySwapV2`).
3. **SSH:** From your own machine, try `ssh SSH_USER@SSH_HOST "cd SERVER_APP_PATH && pwd && ls -la"` (using the same values you put in secrets). If that works, the workflow can run the same commands.

---

## If FTP files still don’t update

- Confirm **FTP_REMOTE_DIR** has **no trailing slash** and points to the **app root** (so the workflow uploads to `FTP_REMOTE_DIR/public/build/` = your Laravel `public/build/`).
- In cPanel **File Manager**, go to the app root and check `public/build/`. After a deploy, `manifest.json` and `version.json` should have recent timestamps. If they’re old or missing, the FTP upload is going to the wrong path or failing (check the “Upload public/build via FTP” step in the Actions run logs).
- The workflow now has a “Verify deploy secrets are set” step; if any secret is missing, the deploy job fails with a message listing which ones to add.
