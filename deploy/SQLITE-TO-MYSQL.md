# Step-by-step: Move your data from SQLite (local) to MySQL (Bluehost)

Your app uses **SQLite** on your machine (`database/database.sqlite`) and **MySQL** on Bluehost. Code deploys via Git; data does not. You can either do a **full replace** (drop and reload) or **push/merge** (update live without dropping).

- **Full replace** (Parts 1–4 below): use `mysql_export.sql` — drops existing tables and loads your local data. Use when setting up the first time or when you want the live DB to be an exact copy of local.
- **Push/merge** (see [Push data without dropping](#push-data-without-dropping-merge)): use `mysql_merge.sql` — inserts new rows and updates existing rows by primary key. Use when you want to update the live site’s data from local **without** wiping existing live data.

---

## Part 1: Create a MySQL database on Bluehost

1. Log in to **Bluehost cPanel**.
2. Open **MySQL® Databases** (or **MySQL Databases**).
3. **Create a new database**
   - Under “Create New Database”, enter a name (e.g. `donkey_swap`).
   - Click “Create Database”.
   - Note the full name: it’s usually `cpaneluser_donkey_swap` (your cPanel username + your name). **You’ll need this as `DB_DATABASE`.**
4. **Create a MySQL user**
   - Under “Add New User”, choose a username and a strong password.
   - Click “Create User”.
   - Note the full username (e.g. `cpaneluser_dbuser`) and the password. **You’ll need these as `DB_USERNAME` and `DB_PASSWORD`.**
5. **Add the user to the database**
   - Under “Add User To Database”, select the user and the database.
   - Click “Add”.
   - On the next screen, check **ALL PRIVILEGES**, then “Make Changes”.

Write these down:

- **DB_DATABASE** = full database name (e.g. `cpaneluser_donkey_swap`)
- **DB_USERNAME** = full MySQL username (e.g. `cpaneluser_dbuser`)
- **DB_PASSWORD** = the password you set

---

## Part 2: Export your SQLite data to a MySQL file (on your machine)

1. Open a terminal and go to your project folder:
   ```bash
   cd c:\Users\mikeb\Herd\donkey-swap-v2
   ```
2. Make sure your app is using SQLite (your `.env` should have `DB_CONNECTION=sqlite` and the file `database\database.sqlite` should exist).
3. Run the export script (it creates the file for you, with no BOM so phpMyAdmin accepts it):
   ```bash
   php scripts/sqlite-to-mysql.php
   ```
4. If you see no errors, you now have **`mysql_export.sql`** in the project root. That file is ready to import into MySQL.

---

## Part 3: Import the data into MySQL on Bluehost

1. In cPanel, open **phpMyAdmin**.
2. In the left sidebar, click the **database** you created (e.g. `cpaneluser_donkey_swap`).
3. Click the **Import** tab.
4. Click **Choose File** and select **`mysql_export.sql`** from your project folder.
5. Leave the rest as default and click **Go** at the bottom.
6. Wait until you see a success message. If you get errors (e.g. timeout or size limit), you may need to import via SSH or split the file; for typical small DBs this works in the browser.

---

## Part 4: Point the site on the server at MySQL

The app on Bluehost must use MySQL instead of SQLite. You do that by editing `.env` on the server.

1. On the server, open the **`.env`** file in your app root (e.g. in **File Manager** or over **FTP/SSH**).
2. Set the database section to use MySQL and the credentials from Part 1:

   ```env
   DB_CONNECTION=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_DATABASE=cpaneluser_donkey_swap
   DB_USERNAME=cpaneluser_dbuser
   DB_PASSWORD=your_mysql_password_here
   ```

   Replace `cpaneluser_donkey_swap`, `cpaneluser_dbuser`, and `your_mysql_password_here` with your real database name, username, and password.

3. If you had any `DB_` lines for SQLite (e.g. `DB_CONNECTION=sqlite`), remove or comment them so only the MySQL block above is in use.
4. Clear Laravel’s config cache (SSH into the server, then):

   ```bash
   cd /home4/mikebane/DonkeySwapV2
   php artisan config:clear
   php artisan config:cache
   ```

   (Use your real path if different; the deploy docs have the exact path.)

5. Reload your site in the browser. You should see the same data as on your machine.

---

## Push data without dropping (merge)

When you want to **update the live database with your local data** without dropping tables or wiping existing data (e.g. live has users or content you want to keep), use **merge mode**.

1. **On your machine** (with `.env` using `DB_CONNECTION=sqlite` and `database/database.sqlite` present):
   ```bash
   cd c:\Users\mikeb\Herd\donkey-swap-v2
   php scripts/sqlite-to-mysql.php --merge --for-github
   ```
   (You can use `--push` instead of `--merge`; both do the same thing. `--for-github` also writes `deploy/to-live/mysql_merge.sql` for the Action.)

2. This creates **`mysql_merge.sql`** in the project root (gitignored) and **`deploy/to-live/mysql_merge.sql`** (the one you commit for GitHub). The SQL uses `INSERT ... ON DUPLICATE KEY UPDATE`: rows that exist on the server (same primary key) are **updated**; new rows are **inserted**. No `DROP TABLE` or `CREATE TABLE` — existing tables and any rows not in your export are left unchanged.

3. **Get the file to the server and import** (choose one):

   - **Option A – FTP + import via GitHub Actions (only when you say so):**  
     1. Commit and push the merge file (same FTP + SSH secrets as your main deploy). **Pushing does not run anything** — the merge is not automatic.
        ```bash
        git add deploy/to-live/mysql_merge.sql
        git commit -m "chore: db merge to live (will run workflow manually)"
        git push origin main
        ```
     2. In GitHub: **Actions** → **“Push DB merge to live”** → **Run workflow** → **Run workflow**.  
        That **FTP-uploads** the file, runs `php artisan db:import-merge`, then **deletes `mysql_merge.sql` on the server** so the dump is not left on disk.
     3. **Check the live site** and confirm the data looks right.
     4. **Remove the SQL from the repo** (recommended for security — it still exists in git history until you rewrite history; for a private repo that is usually enough):
        ```bash
        git rm deploy/to-live/mysql_merge.sql
        git commit -m "chore: remove db merge payload after live import"
        git push origin main
        ```
        Next time you need a merge, generate the file again with `--for-github`, commit, push, run the workflow, then remove the file again.

   - **Option B – phpMyAdmin:**  
     Use `mysql_merge.sql` from the project root (run `--merge` without `--for-github` if you prefer). Open your database → **Import** → choose the file → **Go**.

   - **Option C – Manual FTP + SSH:**  
     Upload `mysql_merge.sql` to the app root, then SSH and run `php artisan db:import-merge` or `mysql ... < mysql_merge.sql`.

   **Privacy:** `deploy/to-live/mysql_merge.sql` is **database contents**. Prefer a **private** repo. After you confirm live, **`git rm`** that file and push so the latest tree no longer holds the dump (old commits may still contain it unless you rewrite history).

   **Note:** The merge file is **not** part of the normal code deploy workflow. Nothing runs until you click **Run workflow** on **Push DB merge to live** (or you import manually).

4. Reload the live site. Local changes are now on live; existing live-only data (e.g. users created only on production) is unchanged.

**When to use merge vs full replace**

| Goal | Use |
|------|-----|
| First-time setup or “make live an exact copy of local” | Full replace: `php scripts/sqlite-to-mysql.php` → import `mysql_export.sql` |
| “Push my local changes to live without wiping live” | Merge: `php scripts/sqlite-to-mysql.php --merge` → import `mysql_merge.sql` |

**Note:** Merge does **not** delete rows on the server. If you delete a row locally, the same row on live will still be there after importing `mysql_merge.sql`. To remove data from live you’d need to do that separately (e.g. manual delete or a different process).

---

## Quick checklist

**Full replace (first time or exact copy):**
- [ ] Bluehost: database created, user created, user added to database with All Privileges.
- [ ] Local: `php scripts/sqlite-to-mysql.php` ran with no errors (creates `mysql_export.sql`).
- [ ] Bluehost: phpMyAdmin → correct database → Import → `mysql_export.sql` → success.
- [ ] Server `.env`: `DB_CONNECTION=mysql`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_HOST=localhost` set.
- [ ] Server: `php artisan config:clear` and `php artisan config:cache` run.
- [ ] Site loads and shows your data.

**Push/merge (update live from local without dropping):**
- [ ] Local: `php scripts/sqlite-to-mysql.php --merge --for-github`
- [ ] `git add deploy/to-live/mysql_merge.sql && git commit && git push` (push alone does **not** import).
- [ ] GitHub → Actions → **“Push DB merge to live”** → **Run workflow** (only when you are ready).
- [ ] Confirm live site data.
- [ ] `git rm deploy/to-live/mysql_merge.sql && git commit && git push` (remove payload from repo).

---

## If something goes wrong

- **“Error: DB_CONNECTION must be sqlite”**  
  Your `.env` has `DB_CONNECTION=mysql` or something else. Set it to `sqlite` and ensure `database/database.sqlite` exists, then run the export again.

- **“SQLite file not found”**  
  Create the file with `touch database/database.sqlite` (or on Windows, create an empty `database\database.sqlite`), run `php artisan migrate`, then export again.

- **Import fails in phpMyAdmin (timeout or size)**  
  Your export might be large. Try increasing PHP limits in cPanel (e.g. “Select PHP Version” → “Options” → `upload_max_filesize` / `post_max_size`), or import via SSH:  
  `mysql -u DB_USERNAME -p DB_DATABASE < mysql_export.sql` (run on the server where MySQL is installed).

- **Site still shows no data or 500 after import**  
  Double-check `.env` on the server (database name, user, password, `DB_CONNECTION=mysql`). Run `php artisan config:clear` and `php artisan config:cache` again. Check Laravel logs in `storage/logs/laravel.log` on the server for the exact error.
