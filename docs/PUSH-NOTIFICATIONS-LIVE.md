# Push notifications on the live site (including Android)

If push notifications work locally but **not on the live site** or **not on Android**, check the following.

## 1. Environment variables on the server

On the **live server** `.env` must have:

```env
# Required for push to work at all
VAPID_PUBLIC_KEY=your_base64url_public_key
VAPID_PRIVATE_KEY=your_base64url_private_key

# Optional; used by the Web Push library
VAPID_SUBJECT=mailto:you@example.com

# Required for icon/links in notifications (Android needs absolute HTTPS URLs)
APP_URL=https://donkeyswapv2.mikebane.com
```

- Generate VAPID keys: `php artisan webpush:vapid` (or use [vapidkeys.com](https://vapidkeys.com/)).
- **APP_URL** must be the **exact** live site URL (https, no trailing slash). If this is wrong, the notification icon can fail on Android and some clients may not show the notification.

## 2. Service worker (`sw.js`) must be deployed

- The file **`public/sw.js`** must be present on the live server and served at `https://your-domain.com/sw.js`.
- If your deploy only uploads `public/build/`, add a step to deploy `public/sw.js` as well (same origin, root path).
- The browser will cache it; after fixing, users may need to **clear site data** or **unregister** the old worker (e.g. in Chrome: Application → Service Workers → Unregister) and reload.

## 3. HTTPS and same origin

- Push only works over **HTTPS** (and localhost). The live site must use HTTPS.
- The service worker is registered with scope `/`. The app and `sw.js` must be on the same origin (same scheme + domain + port).

## 4. Android-specific: padding and payload

- Some Android / FCM endpoints are sensitive to payload size or padding. If notifications never appear on Android (but do on desktop), try in the **live** `.env`:

```env
# Can help Firefox Android and some Chrome Android setups
WEBPUSH_AUTOMATIC_PADDING=false
```

- Then run `php artisan config:clear` (or redeploy) so the config is reloaded.

## 5. Confirm subscription and send path

- **Subscribe:** After login, the app registers the service worker and calls `POST /api/push-subscription` with the subscription payload. Check the browser Network tab: the request should return **200** and the body `{"ok":true}`. If it fails, check that `vapid_public_key` is present in the page (e.g. in Inertia shared props or `window.__VAPID_PUBLIC_KEY__`).
- **Send:** When a notification is created (e.g. new offer), `AppNotificationObserver` sends the web push. If VAPID keys are missing, it skips sending. Check the server logs: on failure you should see a warning like `Web push failed for notification ...`.

## 6. Quick checklist

| Check | What to verify |
|-------|----------------|
| VAPID keys in `.env` on server | `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` set |
| APP_URL on server | Exactly `https://your-domain.com` (no trailing slash) |
| `sw.js` on server | `https://your-domain.com/sw.js` returns the service worker script |
| Subscription saved | `push_subscriptions` table has a row for the user after they enable notifications |
| Permission | User has granted “Notifications” in the browser (and not revoked for the site) |
| Android padding | If only Android fails, try `WEBPUSH_AUTOMATIC_PADDING=false` |

## 7. Testing from the server

You can trigger a test notification from the admin Message Center (send to “Notification” delivery) or by creating a swap offer that generates a notification. Then check:

- Server logs for “Web push failed” messages.
- On the device: browser not in “Do Not Disturb” / battery saver that blocks notifications.
- Chrome on Android: `chrome://gcm-internals` (if available) can show FCM registration and message receipt.
