# Step-by-step: Move your data from SQLite (local) to MySQL (Bluehost)

Your app uses **SQLite** on your machine (`database/database.sqlite`) and **MySQL** on Bluehost. Code deploys via Git; data does not. Follow these steps once to copy your local data to the server.

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

## Quick checklist

- [ ] Bluehost: database created, user created, user added to database with All Privileges.
- [ ] Local: `php scripts/sqlite-to-mysql.php > mysql_export.sql` ran with no errors.
- [ ] Bluehost: phpMyAdmin → correct database → Import → `mysql_export.sql` → success.
- [ ] Server `.env`: `DB_CONNECTION=mysql`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_HOST=localhost` set.
- [ ] Server: `php artisan config:clear` and `php artisan config:cache` run.
- [ ] Site loads and shows your data.

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
