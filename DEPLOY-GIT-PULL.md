# Deploy to Bluehost with Git Pull (walkthrough)

This guide sets up **Git-pull deploy** on Bluehost so you no longer rely on FTP uploads. After setup, you push to GitHub from Cursor, then run a short script on the server (or pull in cPanel + run the script) to update the site.

**You will need:** Bluehost cPanel access, and **SSH** or **cPanel Terminal** so you can run `git pull`, `composer`, and `npm` on the server.

---

## Part 1: Enable SSH (if you haven’t already)

1. Log in to **Bluehost** → **Hosting** → **cPanel**.
2. In **Security**, open **SSH Access**.
3. If needed, use **Manage SSH Keys** to generate or import a key, then enable **Shell Access** for your account.
4. Note how you connect (e.g. **Launch Console** in cPanel, or SSH with your cPanel username and key).

Bluehost’s own help: [SSH Access](https://www.bluehost.com/help/article/ssh-access).

---

## Part 2: Clone the repo on the server (one-time)

You can use **cPanel Git** or **SSH**.

### Option A: cPanel Git Version Control

1. In cPanel go to **Files** → **Git Version Control** (or **Git™ Version Control**).
2. Click **Create**.
3. **Repository Name:** e.g. `DonkeySwapV2`.
4. **Repository Path:** e.g. `public_html/DonkeySwapV2` (this will be the app root; the repo will be cloned here).
5. **Clone URL:**  
   `https://github.com/MikeBane57/DonkeySwapV2.git`
6. Turn **ON** “Clone a Repository” (or similar).
7. Click **Create**. Wait until the clone finishes.

If the interface has a “Branch” field, use `main`.

**Important:** Some cPanel setups clone into a subfolder (e.g. `public_html/DonkeySwapV2/DonkeySwapV2`). Check in **File Manager** and note the folder that contains `artisan`, `composer.json`, and `public` — that folder is your **app root**. Use that path in the steps below.

### Option B: Clone via SSH (Terminal)

1. In cPanel open **Terminal** (or connect with SSH to your account).
2. Go to where you want the app, e.g. `public_html`:
   ```bash
   cd ~/public_html
   ```
3. Clone (use HTTPS if you don’t have an SSH key on GitHub):
   ```bash
   git clone https://github.com/MikeBane57/DonkeySwapV2.git
   cd DonkeySwapV2
   ```
4. If the repo is **private**, you’ll need to set up authentication (e.g. Personal Access Token in the clone URL, or SSH key in cPanel and use `git@github.com:MikeBane57/DonkeySwapV2.git`).

Your **app root** is the folder that contains `artisan`, `composer.json`, and `public`.

---

## Part 3: Point the site at Laravel’s `public` folder (one-time)

1. In cPanel go to **Domains** (or **Domains** → **Domains**).
2. Find the domain for this app → **Manage**.
3. Set **Document Root** to the **`public`** folder inside the app root.  
   Examples:
   - App in `public_html/DonkeySwapV2` → document root: `public_html/DonkeySwapV2/public`
   - App in `public_html/DonkeySwapV2/DonkeySwapV2` → document root: `public_html/DonkeySwapV2/DonkeySwapV2/public`
4. Save.

---

## Part 4: PHP and Node on the server

- **PHP:** In cPanel (**MultiPHP INI Editor** or **Select PHP Version**) set this domain/account to **PHP 8.4** (or 8.2+).
- **Node.js:** For `npm run build` you need Node on the server. In cPanel, look for **Setup Node.js App** or **Application Manager**; create a Node app and note the path, or use the system Node if available. In Terminal you can run `node -v` and `npm -v` to confirm. If Node isn’t available, we can adjust the deploy script to skip the front-end build and use a pre-built `public/build` (different workflow).

---

## Part 5: Create `.env` on the server (one-time)

1. In **File Manager** go to the **app root** (where `artisan` and `composer.json` are).
2. Copy `.env.example` to `.env` (or create `.env` and paste the contents of `.env.example`).
3. Edit `.env` and set at least:
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - `APP_URL=https://yourdomain.com`
   - `APP_KEY=` — generate locally with `php artisan key:generate --show` and paste the value.
   - MySQL: `DB_CONNECTION=mysql`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
   - `SESSION_DRIVER=file` (or `database` if you use DB sessions)
4. Save.

---

## Part 6: First-time build and migrate

Run these **once** from the app root (SSH or cPanel Terminal). Replace `~/public_html/DonkeySwapV2` with your actual app root path if different.

```bash
cd ~/public_html/DonkeySwapV2
composer install --no-dev --optimize-autoloader --no-interaction
npm ci
npm run build
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

If `npm` isn’t in your PATH, use the full path from **Setup Node.js App** (e.g. `~/nodevenv/public_html/DonkeySwapV2/10/bin/npm`).

---

## Part 7: Make the deploy script runnable (one-time)

From the app root:

```bash
chmod +x deploy/server-deploy.sh
```

(If the script lives at `DonkeySwapV2/deploy/server-deploy.sh`, this makes it executable.)

---

## Part 8: How you deploy from now on

1. **In Cursor:** commit and push to `main`:
   ```bash
   git add .
   git commit -m "Your message"
   git push origin main
   ```
2. **On the server:** run the deploy script (SSH or cPanel Terminal):
   ```bash
   cd ~/public_html/DonkeySwapV2
   ./deploy/server-deploy.sh
   ```
   Or from the `deploy` folder:
   ```bash
   cd ~/public_html/DonkeySwapV2/deploy
   bash server-deploy.sh
   ```

The script will:

- `git pull origin main`
- `composer install --no-dev ...`
- `npm ci && npm run build`
- `php artisan migrate --force`
- `php artisan config:cache` and `route:cache`

If you use **cPanel Git** instead of command-line Git, use “Update from Remote” / “Pull” in the Git interface first, then run only the composer/npm/artisan part (see “Deploy script without Git” below).

---

## Deploy script without Git (cPanel “Pull” only)

If you **only** use cPanel’s “Pull or Deploy” and don’t run `git` in Terminal, use a script that skips `git pull`:

1. In cPanel Git, click **Update from Remote** / **Pull** for the repo.
2. Then run on the server (from app root):
   ```bash
   composer install --no-dev --optimize-autoloader --no-interaction
   npm ci
   npm run build
   php artisan migrate --force
   php artisan config:cache
   php artisan route:cache
   ```
   You can paste these into a small `deploy-no-git.sh` or run them by hand each time.

---

## Writable directories

Ensure the web server can write to Laravel’s dirs:

- `storage` and `bootstrap/cache` → chmod **775** (or 755 if your host recommends it). In File Manager: right‑click folder → **Change Permissions**.

---

## Turning off the old FTP deploy

So a push to `main` doesn’t start the long FTP job anymore:

1. Open `.github/workflows/deploy-bluehost.yml` in your repo.
2. Change the `on:` section so it only runs when you choose “Run workflow” (manual trigger), and remove the automatic push trigger.

We can do that in the repo for you so “Deploy to Bluehost” only runs when you click **Run workflow** in the Actions tab, and you use Git pull + this script for normal deploys.

---

## Quick checklist

| Step | Done |
|------|------|
| Enable SSH / Terminal on Bluehost | ☐ |
| Clone repo (cPanel Git or `git clone`) to e.g. `public_html/DonkeySwapV2` | ☐ |
| Set document root to `.../DonkeySwapV2/public` | ☐ |
| PHP 8.4 (or 8.2+); Node available for `npm run build` | ☐ |
| Create `.env` in app root (APP_KEY, DB_*, APP_URL) | ☐ |
| First-time: composer install, npm ci, npm run build, migrate, cache | ☐ |
| `chmod +x deploy/server-deploy.sh` | ☐ |
| Future deploys: push from Cursor, then run `./deploy/server-deploy.sh` on server | ☐ |

If you tell me whether you’re using cPanel Git or SSH and what path your app root has, the steps can be narrowed to exactly what you see on your screen.
