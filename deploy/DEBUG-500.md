# Debugging 500 errors on the live site

When a request returns **500 Internal Server Error** (e.g. POST to `/api/shifts/165/postings`), the app is throwing an exception on the server. Use one of these to see the real error.

## Option 1: Laravel log (best for production)

1. On the server, open the log file:
   - **SSH:** `tail -100 /path/to/your/app/storage/logs/laravel.log`
   - **cPanel File Manager:** go to `DonkeySwapV2/storage/logs/` and open `laravel.log`, then scroll to the bottom.

2. Reproduce the error (e.g. click Post again), then refresh or run `tail` again. The newest block of lines will show the exception message and stack trace.

3. Fix the cause (e.g. missing column, wrong type, env value). Then set `APP_DEBUG=false` again if you had turned it on.

## Option 2: See the error in the browser (temporary)

1. On the server, edit `.env` and set:
   ```env
   APP_DEBUG=true
   ```
2. Clear config cache: `php artisan config:clear` (or redeploy).
3. In the browser, open **F12 → Network**, trigger the failing action (e.g. click Post), then click the red request and open **Response** (or **Preview**). The JSON body will include `message`, `exception`, `file`, and `line` for the error.
4. Set `APP_DEBUG=false` again and run `php artisan config:clear` when done.

## Typical causes after moving from SQLite to MySQL

- **Column missing or wrong type:** Run migrations on the server so the schema matches: `php artisan migrate --force`. If you imported data from an SQL export, the schema might still differ from the migrations (e.g. JSON columns).
- **Foreign key or constraint:** The related row (e.g. shift, user) might be missing in the DB on the server.
- **Env / config:** Wrong `DB_*`, `APP_KEY`, or session config can cause runtime errors.
