# Deploy to Bluehost (GitHub Actions)

This project is set up to deploy to Bluehost automatically when you push to the `main` branch on GitHub. Follow these steps to finish setup.

## 1. Create GitHub repo and push

1. On [GitHub](https://github.com/new), create a **new repository** (e.g. `donkey-swap-v2`). Do **not** add a README, .gitignore, or license so you can push existing code.
2. In your project folder, add the remote and push (replace `YOUR_USERNAME` with your GitHub username):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/donkey-swap-v2.git
   git push -u origin main
   ```

3. (Optional) Set your Git identity if you haven’t already:
   ```bash
   git config user.name "Your Name"
   git config user.email "your@email.com"
   ```

## 2. Bluehost one-time setup

Do this once so the first deploy has a valid target.

- **Document root:** Point your domain (or subdomain) to the Laravel **`public`** folder.  
  Example: if the app is in `public_html/donkey-swap-v2`, set document root to `public_html/donkey-swap-v2/public`.  
  In cPanel: **Domains** → your domain → **Document Root**.

- **PHP:** Use **PHP 8.2 or 8.3**. In cPanel: **MultiPHP INI Editor** or **Select PHP Version**.

- **MySQL:** Create a database and user in cPanel (**MySQL Databases**). Note: host (often `localhost`), database name, username, password.

- **`.env` on the server:** After the **first** deploy, create a `.env` file in the app root on Bluehost (same folder as `artisan`). Copy from `.env.example` and set at least:
  - `APP_ENV=production`
  - `APP_DEBUG=false`
  - `APP_URL=https://yourdomain.com`
  - `APP_KEY=` — run `php artisan key:generate --show` locally and paste the key.
  - `DB_CONNECTION=mysql`, `DB_HOST=...`, `DB_DATABASE=...`, `DB_USERNAME=...`, `DB_PASSWORD=...`
  - `SESSION_DRIVER=file` or `database` (if database, run migrations first).

- **Permissions:** Ensure `storage` and `bootstrap/cache` are writable by the web server (e.g. chmod 775).

- **Migrations:** After the first deploy and after creating `.env`, run on the server (via cPanel Terminal or SSH):  
  `php artisan migrate --force`

## 3. GitHub Actions secrets

In your GitHub repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add:

| Secret name       | Example value              | Description                          |
|-------------------|----------------------------|--------------------------------------|
| `FTP_SERVER`      | `ftp.yourdomain.com`       | Bluehost FTP host                    |
| `FTP_USERNAME`    | Your cPanel FTP username   | FTP login                            |
| `FTP_PASSWORD`    | Your FTP password          | FTP password                         |
| `FTP_REMOTE_DIR`  | `/public_html/donkey-swap-v2` | Remote path to app (no trailing slash) |

Get FTP details from Bluehost cPanel under **FTP** or **FTP Accounts**.

## 4. After first deploy

1. Create `.env` on the server (see step 2) if you haven’t already.
2. Run migrations: `php artisan migrate --force` (cPanel Terminal or SSH).
3. Optionally run: `php artisan config:cache` and `php artisan route:cache`.

## Flow

- Edit in Cursor → commit → **push to `main`** → GitHub Actions builds the app and deploys via FTP to Bluehost. The workflow does **not** overwrite `.env` or `storage/logs` on the server.
