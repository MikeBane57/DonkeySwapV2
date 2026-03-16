/* Service worker for web push notifications.
 * Must show the notification immediately inside waitUntil so Safari does not revoke permission.
 */
self.addEventListener('push', function (event) {
    if (!event.data) return;
    var showPromise = event.data.json()
        .catch(function () { return {}; })
        .then(function (payload) {
            var title = payload.title || 'Donkey Swap';
            var options = {
                body: payload.body || '',
                icon: payload.icon || '/images/donkey-swap-logo.png',
                badge: payload.badge || payload.icon || '/images/donkey-swap-logo.png',
                tag: payload.tag || 'swap',
                data: { url: (payload.data && payload.data.url) ? payload.data.url : '/app' },
            };
            var badgeCount = payload.data && payload.data.badgeCount;
            if (typeof badgeCount === 'number' && badgeCount >= 0 && 'setAppBadge' in self.navigator) {
                self.navigator.setAppBadge(Math.min(99, badgeCount)).catch(function () {});
            }
            return self.registration.showNotification(title, options);
        });
    event.waitUntil(showPromise);
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const url = event.notification.data?.url || '/app';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
