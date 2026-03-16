# Bluehost cPanel Setup — Step by Step

Do these in order. You can stop after any step and come back later.

---

## STEP 1: Find “Git Version Control” in cPanel

1. You’re in **cPanel** (you got here from Bluehost → Hosting → cPanel).
2. Scroll down. Look for a section called **Files**.
3. In the **Files** section, find **“Git Version Control”** or **“Git™ Version Control”**.
4. **Click** **Git Version Control**.

If you don’t see it, use the **Search** box at the top of cPanel and type **Git**. Click the result that says Git Version Control.

---

## STEP 2: Create a new Git repository (clone from GitHub)

1. On the Git Version Control page, click the button **“Create”** (or **“Clone Repository”**).
2. You’ll see a form. Fill it in like this:

   - **Repository Name**  
     Type: `DonkeySwapV2`  
     (This is just a label; it can be any short name.)

   - **Repository Path** or **Path to Repository**  
     Type: `public_html/DonkeySwapV2`  
     (This is the folder on the server where the project will live. Don’t add anything after `DonkeySwapV2`.)

   - **Clone URL** or **Repository URL**  
     Type exactly:  
     `https://github.com/MikeBane57/DonkeySwapV2.git`

   - **Branch** (if you see it)  
     Type: `main`

   - **Clone a Repository** or **Clone?**  
     Turn this **ON** (check the box or set the switch to Yes).  
     This tells cPanel to download the code from GitHub into the path you set.

3. Click **“Create”** (or **“Clone”**) at the bottom.
4. Wait. It can take 1–2 minutes. When it’s done you’ll see a success message or a list that includes `DonkeySwapV2`.

**Done with Step 2:** The code from GitHub is now on your server in `public_html/DonkeySwapV2`.

---

## STEP 3: Check where the app really is (in case of an extra folder)

Some cPanel setups create an extra folder. We need to know the folder that contains **artisan**, **composer.json**, and a **public** folder.

1. In cPanel, open **File Manager** (under **Files**).
2. In the left sidebar, click **public_html**.
3. Click the folder **DonkeySwapV2**.
4. Look at what’s inside:
   - If you see **artisan**, **composer.json**, and a **public** folder → your **app root** is `public_html/DonkeySwapV2`. Remember: **“app root = DonkeySwapV2”**.
   - If you see only another folder (e.g. another **DonkeySwapV2**), click into it. If *that* folder has **artisan**, **composer.json**, and **public** → your **app root** is `public_html/DonkeySwapV2/DonkeySwapV2`. Remember: **“app root = DonkeySwapV2/DonkeySwapV2”**.

Write down your app root path. You’ll use it in the next step.

---

## STEP 4: Point your domain at the Laravel “public” folder

The site must run from the **public** folder inside the app root, not the app root itself.

1. In cPanel, go back to the main screen (click the cPanel logo or **Home**).
2. Find the **Domains** section. Click **“Domains”** (or **“Domains” → Domains**).
3. You’ll see a list of your domains. Find the one you use for this site (e.g. `yourdomain.com`).
4. Click **“Manage”** (or the pencil icon) next to that domain.
5. Find **“Document Root”** or **“Root Domain”**. It might say something like `public_html` or `public_html/yourdomain.com`.
6. Change it to your app’s **public** folder:
   - If your app root is **DonkeySwapV2**: type  
     `public_html/DonkeySwapV2/public`
   - If your app root is **DonkeySwapV2/DonkeySwapV2**: type  
     `public_html/DonkeySwapV2/DonkeySwapV2/public`
7. Click **“Save”** or **“Change”**.

**Done with Step 4:** Your domain now serves the Laravel app from the correct folder.

---

## STEP 5: Set PHP version to 8.4

1. In cPanel, search for **“PHP”** or look under **Software**.
2. Click **“Select PHP Version”** or **“MultiPHP Manager”**.
3. Select your domain (or “All domains” / your account).
4. Set the PHP version to **8.4** (or **8.2** or **8.3** if 8.4 isn’t there).
5. Save.

---

## STEP 6: Create the `.env` file on the server

1. Open **File Manager** again.
2. Go to your **app root** (the folder that has **artisan** and **composer.json** — e.g. `public_html/DonkeySwapV2` or `public_html/DonkeySwapV2/DonkeySwapV2`).
3. Find the file **`.env.example`**. (You may need to click **“Settings”** in File Manager and check **“Show Hidden Files”** to see it.)
4. Right‑click **`.env.example`** → **“Copy”**.
5. In the dialog, set the copy path to the same folder (your app root). For the new file name type: `.env`
6. Click **Copy**.
7. Right‑click the new **`.env`** file → **“Edit”**.
8. Change at least these lines (replace with your real values):

   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - `APP_URL=https://yourdomain.com`   ← use your real domain
   - `APP_KEY=`   ← leave empty for now; we’ll add it in a moment
   - `DB_CONNECTION=mysql`
   - `DB_HOST=localhost`   (or what Bluehost shows for MySQL host)
   - `DB_DATABASE=`   ← your MySQL database name from cPanel
   - `DB_USERNAME=`   ← your MySQL username
   - `DB_PASSWORD=`   ← your MySQL password
   - `SESSION_DRIVER=file`

9. **APP_KEY:** On your own computer, in Cursor, open a terminal in the project folder and run:  
   `php artisan key:generate --show`  
   Copy the long key it prints (starts with `base64:...`) and paste it into `.env` as the value for `APP_KEY=`.
10. Save the `.env` file and close the editor.

**Done with Step 6:** The app has its config and database settings.

---

## STEP 7: Enable SSH so you can run commands (Terminal)

You need a way to run commands on the server (for composer, npm, and the deploy script).

1. In cPanel, go to the **Security** section.
2. Click **“SSH Access”**.
3. If you see **“Shell Access”** or **“Enable Shell Access”**, turn it **ON** or click to enable it.
4. If it asks you to create or import an SSH key first, use **“Generate a New Key”** or **“Import Key”** and follow the prompts, then enable Shell Access.
5. Look for **“Launch Console”** or **“Open Terminal”** (might be on the same page or under **Advanced**). That’s how you’ll run the commands in Step 8.

If you don’t see SSH Access, use cPanel’s search and type **SSH** or **Terminal**.

---

## STEP 8: Run the first-time build in Terminal

This step runs the commands that install PHP dependencies, build the front end, and run migrations. You do this **once** after the clone.

1. Open **Terminal** (or **Launch Console**) from cPanel — the same place you enabled SSH.
2. Type this and press Enter (use your actual app root path if it’s different):

   ```bash
   cd ~/public_html/DonkeySwapV2
   ```

   If your app root is inside an extra folder (from Step 3), use:

   ```bash
   cd ~/public_html/DonkeySwapV2/DonkeySwapV2
   ```

3. Then run these one at a time (copy each line, paste in the terminal, press Enter, wait for it to finish before the next):

   ```bash
   composer install --no-dev --optimize-autoloader --no-interaction
   ```

   ```bash
   npm ci
   ```

   ```bash
   npm run build
   ```

   ```bash
   php artisan migrate --force
   ```

   ```bash
   php artisan config:cache
   ```

   ```bash
   php artisan route:cache
   ```

If **npm** says “command not found”, your host doesn’t have Node.js (common on Bluehost). **Skip the npm lines.** Instead: on your computer, in the project folder, run `npm ci` and `npm run build`, then in cPanel File Manager upload your local **public/build** folder into the server’s **public** folder (so the server has **public/build** with the built JS/CSS). The deploy script on the server is set up to skip npm.

4. Then make the deploy script runnable:

   ```bash
   chmod +x deploy/server-deploy.sh
   ```

**Done with Step 8:** The site is built and ready. Open your domain in a browser; you should see the app (or the login page).

---

## STEP 9: When you update the site later (deploy)

**Backend (PHP, database, etc.):** On the server, in Terminal:

```bash
cd ~/DonkeySwapV2
git pull origin main
./deploy/server-deploy.sh
```

**Frontend (JS/CSS/React):** This can be automated. The repo has a workflow **“Deploy frontend assets”** that runs on push to `main` when you change front-end files: it runs `npm run build` and uploads only **public/build** to the server via FTP. You need the same GitHub secrets as before: **FTP_SERVER**, **FTP_USERNAME**, **FTP_PASSWORD**, **FTP_REMOTE_DIR** (app root on the server as FTP sees it, e.g. `public_html/DonkeySwapV2` or `DonkeySwapV2`). Then you don’t need to build or upload **public/build** by hand.

If you don’t use the workflow: after pushing, run `npm run build` on your computer and upload the **public/build** folder to the server’s **public** folder in File Manager.

---

## Quick reference

| Step | What you do |
|------|-------------|
| 1 | cPanel → Files → Git Version Control |
| 2 | Create clone: path `public_html/DonkeySwapV2`, URL `https://github.com/MikeBane57/DonkeySwapV2.git`, branch `main` |
| 3 | File Manager → check app root (folder with artisan, composer.json, public) |
| 4 | Domains → Manage → Document root = `.../DonkeySwapV2/public` (or `.../DonkeySwapV2/DonkeySwapV2/public`) |
| 5 | Select PHP Version → 8.4 |
| 6 | File Manager → copy `.env.example` to `.env`, edit and set APP_KEY, DB_*, APP_URL |
| 7 | Security → SSH Access → enable Shell / Launch Console |
| 8 | Terminal → cd to app root → composer install, npm ci, npm run build, migrate, cache, chmod script |
| 9 | Later: push from Cursor, then in Terminal run `./deploy/server-deploy.sh` |

If you tell me which step number you’re on and what you see on the screen, I can give the exact next click or command.
