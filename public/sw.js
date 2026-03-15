/* Service worker for web push notifications. */
self.addEventListener('push', function (event) {
    if (!event.data) return;
    const payload = event.data.json().catch(() => ({}));
    const title = payload.title || 'Donkey Swap';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/images/donkey-swap-logo.png',
        badge: payload.badge || payload.icon || '/images/donkey-swap-logo.png',
        tag: payload.tag || 'swap',
        data: { url: payload.data?.url || '/app' },
    };
    const badgeCount = payload.data?.badgeCount;
    event.waitUntil(
        Promise.all([
            typeof badgeCount === 'number' && badgeCount >= 0 && 'setAppBadge' in self.navigator
                ? self.navigator.setAppBadge(Math.min(99, badgeCount)).catch(function () {})
                : Promise.resolve(),
            self.registration.showNotification(title, options),
        ])
    );
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
