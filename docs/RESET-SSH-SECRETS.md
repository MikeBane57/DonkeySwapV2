# Reset SSH secrets for deploy (full walkthrough)

Use this when the "Deploy on server" step fails with `ssh: unable to authenticate`. It walks you through generating a new key and setting every SSH-related secret from scratch.

Works for **HostGator**, Bluehost, and other cPanel hosts. For a full fresh HostGator install, see **[HOSTGATOR-SETUP.md](HOSTGATOR-SETUP.md)**.

---

## Part 1: Generate a new SSH key pair (on your PC)

1. Open **PowerShell** (or Terminal).

2. Create a dedicated key for this deploy (so you don’t overwrite existing keys):

   ```powershell
   ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\donkeyswapv2_deploy" -C "github-actions-deploy" -N '""'
   ```

   - `-N '""'` = no passphrase (required for GitHub Actions).
   - This creates:
     - **Private:** `C:\Users\mikeb\.ssh\donkeyswapv2_deploy` (no extension)
     - **Public:** `C:\Users\mikeb\.ssh\donkeyswapv2_deploy.pub`

3. Confirm the files exist:

   ```powershell
   dir $env:USERPROFILE\.ssh\donkeyswapv2_deploy*
   ```

---

## Part 2: Add the public key to HostGator (or Bluehost)

1. Show the **public** key so you can copy it:

   ```powershell
   Get-Content "$env:USERPROFILE\.ssh\donkeyswapv2_deploy.pub"
   ```

   Copy the **entire line** (starts with `ssh-ed25519`, ends with `github-actions-deploy`).

2. In **HostGator** (or Bluehost): log in → **cPanel** → **Security** → **SSH Access**.

3. Open **Manage SSH Keys** (or **Import Key**).

4. **Import** a new key:
   - Paste the public key you copied.
   - Save (e.g. name it "GitHub Actions deploy").

5. **Authorize** the key:
   - Find the key you just imported and click **Manage** (or similar).
   - Click **Authorize** so this key can log in. Without this, SSH will reject the key.

6. Note your **SSH details** (you’ll need them for GitHub):
   - **Username:** Your cPanel username (the one you use to log into cPanel).
   - **Host:** The hostname shown for SSH (e.g. `donkeyswapv2.mikebane.com` or the server name in the SSH section).

---

## Part 3: Set GitHub Actions secrets (SSH only)

1. On GitHub: open your repo → **Settings** → **Secrets and variables** → **Actions**.

2. You will set or update these **four** secrets:

   | Secret name        | What to put |
   |--------------------|-------------|
   | `SSH_HOST`         | The SSH hostname (e.g. `donkeyswapv2.mikebane.com`). No `https://`, no path. |
   | `SSH_USER`         | Your **cPanel username** (same as the account that has the authorized key). |
   | `SSH_PRIVATE_KEY` | The **entire contents** of the **private** key file (see below). |
   | `SERVER_APP_PATH`  | Full path to the app root on the server (folder that contains `artisan`, `composer.json`, `public`). No trailing slash. Example: `/home/yourcpanel/public_html/DonkeySwapV2`. |

### Getting the private key into `SSH_PRIVATE_KEY`

1. In PowerShell, show the private key:

   ```powershell
   Get-Content "$env:USERPROFILE\.ssh\donkeyswapv2_deploy" -Raw
   ```

2. Copy **everything**, including:
   - `-----BEGIN OPENSSH PRIVATE KEY-----`
   - All the lines in the middle
   - `-----END OPENSSH PRIVATE KEY-----`

3. In GitHub: **Actions** → **Secrets** → **SSH_PRIVATE_KEY**:
   - If it exists: **Update** and paste the new key.
   - If it doesn’t: **New repository secret** → Name: `SSH_PRIVATE_KEY` → Value: paste → **Add secret**.

**Important:** No extra spaces at the start/end. The first line must be `-----BEGIN OPENSSH PRIVATE KEY-----` and the last line must be `-----END OPENSSH PRIVATE KEY-----`.

### Finding `SERVER_APP_PATH`

- In cPanel **File Manager**, go to the folder that contains:
  - `artisan`
  - `composer.json`
  - `public` (folder)
- The full path to that folder is `SERVER_APP_PATH`. On HostGator/Bluehost it often looks like:
  - `/home/yourcpanelusername/public_html/DonkeySwapV2`

---

## Part 4: Test and re-run deploy

1. **Test from your PC** (optional but recommended):

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\donkeyswapv2_deploy" YOUR_SSH_USER@YOUR_SSH_HOST "cd YOUR_SERVER_APP_PATH && pwd && ls -la artisan"
   ```

   Replace `YOUR_SSH_USER`, `YOUR_SSH_HOST`, and `YOUR_SERVER_APP_PATH` with the same values you put in GitHub. If this works, the same values in GitHub will work.

2. **Re-run the workflow:**
   - GitHub repo → **Actions** → **CI** → **Run workflow**.
   - Open the run and check the **Deploy on server** step. It should get past SSH and run `git pull`, `composer install`, etc.

---

## Checklist

- [ ] New key pair generated (`donkeyswapv2_deploy` + `.pub`)
- [ ] Public key imported and **authorized** in HostGator/Bluehost SSH Access
- [ ] `SSH_HOST` = SSH hostname (no path, no protocol)
- [ ] `SSH_USER` = cPanel username
- [ ] `SSH_PRIVATE_KEY` = full private key (begin/end lines included)
- [ ] `SERVER_APP_PATH` = app root path, no trailing slash
- [ ] Optional: SSH test from PC works
- [ ] Run workflow and confirm "Deploy on server" step succeeds
