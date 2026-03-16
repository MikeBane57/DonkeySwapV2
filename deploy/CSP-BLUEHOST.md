# If CSP Still Blocks Scripts on Bluehost

The app sets a permissive Content-Security-Policy in `public/.htaccess` (and via middleware) so Inertia and React can run. If you still see CSP errors and “Post” (or other actions) do nothing, the host is likely applying a stricter CSP that overrides ours.

## What to do

### 1. Confirm the problem

- Open the live site, then **F12** → **Console**. Note the exact CSP message (e.g. “blocked” for `script-src` or `eval`).
- Click **Post** (or the button that does nothing). Open **Network** tab and see if any request is sent when you click. If **no request** appears, JavaScript is likely blocked by CSP.

### 2. Ask Bluehost to relax or remove CSP

Contact Bluehost support and say something like:

- “My site uses Laravel with Inertia/React. A Content-Security-Policy header is blocking scripts so the app doesn’t work. Can you remove or relax the CSP for my domain so my app can set its own via `.htaccess`?”

They may need to:

- Change Apache config or **ModSecurity** / WAF rules that add the header, or  
- Allow your `.htaccess` to override headers (e.g. `AllowOverride` including `FileInfo` for `Header`).

### 3. Check cPanel for security / headers

In cPanel, look for:

- **Security** → **ModSecurity** (disable for your domain if you’re allowed and only to test).
- **Software** → **Select PHP Version** or **MultiPHP INI Editor** (unlikely to set CSP, but worth a quick look).
- Any **“Headers”** or **“HTTP Headers”** tool that might set CSP.

If you find a CSP or “Security Headers” option, try disabling it or adding an exception for your domain.

### 4. After they relax CSP

Redeploy so the server has the latest `public/.htaccess` (with `Header unset` and our permissive CSP). Do a hard refresh (Ctrl+Shift+R) and test again. The app should then be able to run scripts and “Post” should work.
