# One-push deploy setup (Cursor push = full deploy)

After this setup, **pushing to `main`** will:

1. Build the frontend (`npm run build`)
2. Upload **public/build** to the server via FTP
3. SSH into the server and run `git pull` + the deploy script (composer, migrate, cache)

You only push from Cursor; no manual steps on the server.

---

## 1. SSH key for GitHub Actions

The workflow needs to SSH into your Bluehost account. Create a key pair **only for this** (don’t use your main SSH key).

**On your computer** (PowerShell or Git Bash):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""
```

That creates:

- **deploy_key** (private) → you’ll put this in GitHub Secrets
- **deploy_key.pub** (public) → you’ll put this on the server

---

## 2. Add the public key on the server

- SSH or open **Terminal** in cPanel on Bluehost.
- Run:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_CONTENT_OF_deploy_key.pub_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Paste the **entire** contents of **deploy_key.pub** (one line). Don’t paste the private key.

---

## 3. GitHub Secrets

In your repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add:

| Secret name         | Value |
|---------------------|--------|
| **SSH_HOST**        | Your server hostname, e.g. `box123.bluehost.com` or `yourdomain.com`. Find it in cPanel (e.g. SSH Access or “Connection details”). |
| **SSH_USER**        | Your cPanel username (e.g. `mikebane`). |
| **SSH_PRIVATE_KEY** | The **entire** contents of the **deploy_key** file (private key). Copy from the first line to the last, including `-----BEGIN ... KEY-----` and `-----END ... KEY-----`. |
| **SERVER_APP_PATH**  | Full path to the app on the server, e.g. `/home4/mikebane/DonkeySwapV2`. Run `pwd` in the app folder in Terminal to get this. |

You should already have **FTP_SERVER**, **FTP_USERNAME**, **FTP_PASSWORD**, **FTP_REMOTE_DIR** from before. If not, add those too (for the “upload public/build” step).

**Optional:** If SSH uses a non‑default port, add **SSH_PORT** (e.g. `2222`).

---

## 4. Repo access from the server (private repos only)

If the repo is **private**, the server must be able to `git pull`. On the server:

- Either add the **same deploy key** (deploy_key.pub) as a **read-only deploy key** in GitHub (repo → Settings → Deploy keys),  
- Or use a **Personal Access Token** and set a Git URL like:  
  `https://TOKEN@github.com/MikeBane57/DonkeySwapV2.git`  
  (store the URL in the server’s git remote; don’t put the token in GitHub Secrets for this workflow.)

If the repo is **public**, `git pull` on the server works without extra setup.

---

## 5. Test

1. Commit and push the new workflow (and this doc) to `main`.
2. Go to **Actions** and open the **“Deploy (push = deploy)”** run.
3. If the SSH step fails, check: **SSH_HOST**, **SSH_USER**, **SERVER_APP_PATH**, and that the public key is in `~/.ssh/authorized_keys` on the server.

After that, every push to `main` runs the full deploy automatically.
