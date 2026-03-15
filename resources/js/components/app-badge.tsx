import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Sets the PWA/browser app icon badge and document title when the user has
 * action required or unread notifications.
 *
 * - iOS (16.4+): Badge shows only for home-screen PWAs and only if the user
 *   has granted notification permission. We request permission when setting a badge.
 * - Android: The Badging API does not display on the home screen icon; Android
 *   shows a dot only for actual push notifications. Document title still updates.
 * - Desktop Chrome/Edge: Badge works when the app is installed.
 *
 * We do not clear the badge on unmount so the count persists when the user
 * leaves the app and sees the icon on their home screen.
 */
export function AppBadge() {
    const { badge_count: badgeCount = 0, name: appName = 'Donkey Swap' } = (
        usePage().props as { badge_count?: number; name?: string }
    );

    useEffect(() => {
        const count = Math.min(99, Math.max(0, Number(badgeCount) || 0));

        const setBadge = () => {
            if (!('setAppBadge' in navigator) || typeof navigator.setAppBadge !== 'function') return;
            if (count > 0) {
                navigator.setAppBadge(count).catch(() => {});
            } else {
                navigator.clearAppBadge?.().catch(() => {});
            }
        };

        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().then(setBadge).catch(() => setBadge());
        } else {
            setBadge();
        }

        const baseTitle = typeof appName === 'string' ? appName : 'Donkey Swap';
        document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
    }, [badgeCount, appName]);

    return null;
}
