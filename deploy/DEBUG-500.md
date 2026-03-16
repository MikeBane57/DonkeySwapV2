# Debugging 500 errors on the live site

When a request returns **500 Internal Server Error** (e.g. POST to `/api/shifts/165/postings`), the app is throwing an exception on the server. Use one of these to see the real error.

---

## Option 1: Laravel log (best for production)

1. On the server, open the log file:
   - **SSH:** `tail -100 /path/to/your/app/storage/logs/laravel.log`
   - **cPanel File Manager:** go to `DonkeySwapV2/storage/logs/` and open `laravel.log`, then scroll to the bottom.

2. Reproduce the error (e.g. click Post again), then refresh or run `tail` again. The newest block of lines will show the exception message and stack trace.

3. Fix the cause (e.g. missing column, wrong type, env value). Then set `APP_DEBUG=false` again if you had turned it on.

---

## Option 2: See the error in the browser (temporary)

1. On the server, edit `.env` and set:
   ```env
   APP_DEBUG=true
   ```
2. Clear config cache: `php artisan config:clear` (or redeploy).
3. In the browser, open **F12 → Network**, trigger the failing action (e.g. click Post), then click the red request and open **Response** (or **Preview**). The JSON body will include `message`, `exception`, `file`, and `line` for the error.
4. Set `APP_DEBUG=false` again and run `php artisan config:clear` when done.

---

## Step-by-step: Fix the 500 (expanded)

Follow this when “Post” (or another action) returns 500 and you want to find and fix the cause.

### Step 3a: Turn on debug and clear config (on the server)

1. **Get into your app folder on the server**
   - **SSH:** `cd /home4/mikebane/DonkeySwapV2` (use your real path from `SERVER_APP_PATH`).
   - **cPanel File Manager:** go to the folder that contains `artisan` and `.env` (e.g. `DonkeySwapV2`).

2. **Edit `.env`**
   - Open `.env` and find the line `APP_DEBUG=false`.
   - Change it to:
     ```env
     APP_DEBUG=true
     ```
   - Save the file.

3. **Clear Laravel’s config cache** so it picks up the new value:
   - **SSH:** run `php artisan config:clear`.
   - **cPanel:** if you have “Terminal” or “SSH Access”, run the same there. If you don’t, save `.env` and wait a minute, or run a deploy (deploy often clears config); then try the next step.

### Step 3b: Reproduce the error and read the response

1. **Open your live site** in the browser (e.g. `https://donkeyswapv2.mikebane.com/app`).

2. **Open Developer Tools:** press **F12** (or right‑click → Inspect).

3. **Open the Network tab** in DevTools and leave it open.

4. **Trigger the failing action** (e.g. click the button that “Posts” the shift).

5. **Find the red (failed) request** in the Network list (e.g. `postings` with status **500**). Click it.

6. **Open the Response (or Preview) sub-tab** for that request. You should see JSON like:
   ```json
   {
     "message": "SQLSTATE[42S22]: Column not found: 1054 Unknown column 'preferred_start_times' in 'field list'",
     "exception": "Illuminate\\Database\\QueryException",
     "file": "/home4/.../vendor/laravel/framework/src/Illuminate/Database/Connection.php",
     "line": 712
   }
   ```
   The **`message`** line is the one that tells you what went wrong.

### Step 3c: Interpret the error and fix it

Use the **`message`** (and sometimes **`exception`**) from the response:

| If the message says… | What it usually means | What to do |
|----------------------|------------------------|------------|
| **Column not found** / **Unknown column '…'** | The database table is missing a column the app expects. | Run migrations on the server so the schema matches the app: `php artisan migrate --force` (in the app folder on the server). If you imported from SQLite export, the exported schema may be missing columns that were added in later migrations. |
| **SQLSTATE[23000]** or **foreign key constraint** / **Integrity constraint** | A row references another row that doesn’t exist (e.g. shift_id or user_id). | Check that the related data exists in the DB (e.g. shift 165, the current user). Fix or re-import data, or fix the reference. |
| **SQLSTATE[42S22]** or **Unknown column** | Same as “Column not found” above. | Run `php artisan migrate --force` on the server. |
| **Permission denied** / **file_put_contents** / **storage** | Laravel can’t write to `storage/` or `bootstrap/cache/`. | Fix folder permissions (e.g. `storage` and `bootstrap/cache` writable by the web server). In cPanel, check “Permissions” on those folders (often 755 or 775). |
| **Class … does not exist** / **Target class […] does not exist** | Autoload or config is stale. | Run `composer dump-autoload` and `php artisan config:clear` (and `php artisan cache:clear`) on the server. |
| **Key path [file] does not exist** or **No application encryption key** | `APP_KEY` is missing or wrong in `.env`. | Generate a key: `php artisan key:generate` (on the server, in the app folder), then `php artisan config:clear`. |
| **Connection refused** / **could not find driver** | Database or PHP driver problem. | Check `DB_*` in `.env` (host, user, password, database name). On shared hosting, often `DB_HOST=localhost`. Install or enable the correct PHP MySQL driver if needed. |

**Most likely after a SQLite → MySQL import:**  
The server database is missing columns or tables that exist in your migrations. Run:

```bash
cd /path/to/your/app   # e.g. /home4/mikebane/DonkeySwapV2
php artisan migrate --force
```

`--force` is needed when `APP_ENV=production`. That will add any missing columns/tables. If a migration fails (e.g. “column already exists”), the error will point you to the exact change to fix.

### Step 3d: Turn debug off again

1. On the server, edit **`.env`** and set:
   ```env
   APP_DEBUG=false
   ```
2. Run **`php artisan config:clear`** again (and optionally **`php artisan cache:clear`**).
3. Test the same action again; it should either succeed or return a normal error (e.g. 422) without exposing internals.

---

## Typical causes after moving from SQLite to MySQL

- **Column missing or wrong type:** Run migrations on the server so the schema matches: `php artisan migrate --force`. If you imported data from an SQL export, the schema might still differ from the migrations (e.g. JSON columns).
- **Foreign key or constraint:** The related row (e.g. shift, user) might be missing in the DB on the server.
- **Env / config:** Wrong `DB_*`, `APP_KEY`, or session config can cause runtime errors.
