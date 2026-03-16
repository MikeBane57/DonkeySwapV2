# Deploy to Bluehost (GitHub Actions)

This project is set up to deploy to Bluehost automatically when you push to the `main` branch on GitHub. Follow the steps below to finish setup.

---

## Do I have to run `npm run build` before uploading?

**No.** You do **not** run the build on your computer before pushing.

When you **push** your code to GitHub, a **GitHub Action** runs on GitHub’s servers. That action:

1. Downloads your code
2. Runs `composer install` (PHP dependencies)
3. Runs `npm ci` and **`npm run build`** (builds the React/Vite frontend)
4. Uploads the **already-built** result to Bluehost via FTP

So you only need to **commit and push** your source code. The build and upload are done for you automatically.

---

## What happens when you push (big picture)

1. You edit code in Cursor → commit → push to `main`.
2. GitHub receives the push and starts the “Deploy to Bluehost” workflow.
3. The workflow builds the app (composer + npm build) on GitHub’s servers.
4. The workflow uploads the built files to Bluehost over FTP.
5. Your site on Bluehost is updated.

You never upload from your own machine; GitHub does it after each push.

---

## Live site not showing the latest changes (e.g. Preferences, Qualifications, notification bell)?

The deploy workflow runs **only if Lint and Test both pass**. If either fails, the deploy job is skipped and the live site is not updated.

1. Open **[Actions](https://github.com/MikeBane57/DonkeySwapV2/actions)** for this repo.
2. Click the most recent workflow run for a push to `main`.
3. Check that all three jobs are green: **Lint**, **Test**, and **Build, upload assets, deploy on server**.
4. If any job failed (red), open it and fix the error (e.g. failing test or lint). Then commit, push again, or use **Re-run all jobs** after fixing.
5. If all jobs passed but the site still looks old, do a hard refresh (Ctrl+F5 or Cmd+Shift+R) to avoid cached JS/CSS.

6. **Verify what’s actually on the server:** After a deploy, open `https://YOUR-LIVE-SITE/build/version.json` (use your real domain). You should see `{"commit":"<sha>","date":"..."}` from the last deploy. If that file is missing or shows an old commit, the FTP upload or deploy step failed or went to the wrong path; check the **Deploy** job logs in Actions.

The built frontend (`public/build`) is **not** in the repo; it is built in the workflow and uploaded via FTP. So the live site only gets new UI (menus, notification bell, etc.) when the full workflow runs successfully.

---

## Step 1: Create the GitHub repo and push your code

### 1.1 Create an empty repo on GitHub

1. Go to [https://github.com/new](https://github.com/new).
2. Enter a **Repository name** (e.g. `donkey-swap-v2`).
3. Leave **Public** selected.
4. Do **not** check “Add a README file”, “Add .gitignore”, or “Choose a license”. The repo should be completely empty.
5. Click **Create repository**.

### 1.2 Connect your project to GitHub and push

1. Open a terminal in your project folder (e.g. in Cursor: **Terminal → New Terminal**).
2. Run this (replace `YOUR_USERNAME` with your GitHub username and `donkey-swap-v2` if you used a different repo name):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/donkey-swap-v2.git
   git push -u origin main
   ```

3. If GitHub asks you to sign in, use your GitHub account (or a personal access token if you use 2FA).

After this, your code is on GitHub. You can push future changes with **Source Control** in Cursor or by running `git push` in the terminal.

### 1.3 (Optional) Set your Git name and email

If you haven’t already, set these so your commits show your name:

```bash
git config user.name "Your Name"
git config user.email "your@email.com"
```

---

## Step 2: One-time Bluehost setup

Do this once so the first deploy has a place to go and the app can run.

### 2.1 Choose where the app will live

- Decide the folder on Bluehost, e.g. `public_html/donkey-swap-v2`.
- You can create that folder via cPanel **File Manager** (empty folder is fine; the first deploy will upload into it).

### 2.2 Set the document root to Laravel’s `public` folder

The web server must point at the **`public`** folder inside your app, not the app root.

1. In cPanel go to **Domains** (or **Domains** → **Domains**).
2. Find your domain (or subdomain) and click **Manage** or the pencil icon.
3. Find **Document Root** (or “Root Domain”).
4. Set it to the **`public`** folder. Example: if the app is in `public_html/donkey-swap-v2`, set document root to:
   - `public_html/donkey-swap-v2/public`
5. Save.

### 2.3 Set PHP version

1. In cPanel open **MultiPHP INI Editor** or **Select PHP Version**.
2. Select **PHP 8.2** or **8.3** for the domain or account (Laravel 12 needs 8.2+).

### 2.4 Create the MySQL database and user

1. In cPanel go to **MySQL Databases**.
2. **Create a database:** e.g. `youruser_donkeyswap`. Note the full name (often `youruser_donkeyswap`).
3. **Create a user:** e.g. `youruser_swapuser`, with a strong password. Note username and password.
4. **Add the user to the database:** use “Add User To Database”, give the user **All Privileges** on that database.

You’ll need: **database name**, **username**, **password**, and **host** (often `localhost`).

### 2.5 (After first deploy) Create `.env` on the server

Do this **after** the first successful deploy has uploaded files.

1. In cPanel **File Manager**, go to the app folder (e.g. `public_html/donkey-swap-v2`). You should see `artisan`, `composer.json`, etc.
2. Copy `.env.example` to a new file named `.env` (or create `.env` and paste the contents of `.env.example`).
3. Edit `.env` and set at least:
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - `APP_URL=https://yourdomain.com` (your real URL)
   - `APP_KEY=` — leave empty for now; you’ll add the key in the next step.
   - `DB_CONNECTION=mysql`
   - `DB_HOST=localhost` (or whatever Bluehost shows)
   - `DB_DATABASE=` (the database name from 2.4)
   - `DB_USERNAME=` (the user from 2.4)
   - `DB_PASSWORD=` (that user’s password)
   - `SESSION_DRIVER=file` (simplest; or `database` if you prefer and have run migrations)

4. **Generate an application key** on your **local** machine (in the project folder):
   ```bash
   php artisan key:generate --show
   ```
   Copy the long key that’s printed (e.g. `base64:...`) and paste it as the value of `APP_KEY=` in the server’s `.env`.

### 2.6 Make `storage` and `bootstrap/cache` writable

1. In File Manager, go to the app folder on the server.
2. Right‑click **storage** → **Change Permissions** (or Permissions). Set to **755** or **775** so the web server can write (logs, cache, sessions).
3. Do the same for **bootstrap/cache** (755 or 775).

### 2.7 (After first deploy) Run migrations

After `.env` exists on the server:

1. In cPanel open **Terminal** (if available), or use **SSH** if you have it.
2. Go to the app folder, e.g. `cd public_html/donkey-swap-v2`.
3. Run:
   ```bash
   php artisan migrate --force
   ```

If there’s no Terminal, Bluehost support can run this for you, or you can use a one‑off PHP script that runs the same command (we can add that if you need it).

---

## Step 3: Add GitHub Actions secrets (so the workflow can upload to Bluehost)

The workflow needs your Bluehost FTP details. You store them as **secrets** in GitHub (they are not visible in the repo).

### 3.1 Get your FTP details from Bluehost

1. In cPanel go to **FTP** or **FTP Accounts**.
2. Note:
   - **FTP server** (e.g. `ftp.yourdomain.com` or the hostname shown)
   - **Username** (often your cPanel username or a dedicated FTP user)
   - **Password** for that user

### 3.2 Add four secrets in GitHub

1. On GitHub open your repo (e.g. `donkey-swap-v2`).
2. Click **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret** and add these one by one:

| Secret name     | Value to paste |
|-----------------|----------------|
| `FTP_SERVER`    | Your FTP host (e.g. `ftp.yourdomain.com`) |
| `FTP_USERNAME`  | Your FTP username |
| `FTP_PASSWORD`  | Your FTP password |
| `FTP_REMOTE_DIR`| The folder on the server where the app goes (e.g. `/public_html/donkey-swap-v2`). No trailing slash. |

After this, the next push to `main` will trigger the workflow and it will be able to upload to Bluehost.

---

## Step 4: After the first deploy

1. **Create `.env`** on the server (see 2.5) if you didn’t do it before.
2. **Run migrations** (see 2.7): `php artisan migrate --force` on the server.
3. (Optional) On the server: `php artisan config:cache` and `php artisan route:cache` to cache config and routes.

---

## Quick reference: order of operations

| Order | What to do |
|-------|-------------|
| 1 | Create empty GitHub repo, add remote, push (Step 1). |
| 2 | On Bluehost: create app folder, set document root to `.../public`, set PHP 8.2+, create MySQL DB and user (Steps 2.1–2.4). |
| 3 | Add the four GitHub secrets (Step 3). |
| 4 | Push to `main` (or push again) to trigger the first deploy. |
| 5 | After deploy: create `.env` on server, set permissions, run `php artisan migrate --force` (Steps 2.5–2.7, 4). |

---

## Summary

- You **do not** run `npm run build` (or upload) yourself. You only **push** to GitHub; the workflow builds and uploads.
- Edit in Cursor → commit → push to `main` → GitHub Actions builds and deploys to Bluehost. The workflow does not overwrite `.env` or `storage/logs` on the server.
