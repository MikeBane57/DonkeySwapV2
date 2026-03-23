import { usePage } from '@inertiajs/react';
import { Bell, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';

const STANDALONE_KEY = 'badge-permission-banner-dismissed';

/**
 * Shows when the app is opened from the home screen (standalone) but notification
 * permission isn't granted. Tapping "Enable" uses a user gesture to request
 * permission (required on iOS) and then sets the app icon badge.
 */
export function BadgePermissionBanner() {
    const props = usePage().props as { badge_count?: number };
    const badgeCount = Math.min(
        99,
        Math.max(0, Number(props.badge_count) || 0),
    );
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === 'undefined') return true;
        try {
            return sessionStorage.getItem(STANDALONE_KEY) === '1';
        } catch {
            return false;
        }
    });
    const [enabling, setEnabling] = useState(false);

    const isStandalone =
        typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as { standalone?: boolean }).standalone === true);

    const permission =
        typeof Notification !== 'undefined'
            ? Notification.permission
            : 'denied';
    const show = isStandalone && permission !== 'granted' && !dismissed;

    const handleEnable = useCallback(() => {
        if (typeof Notification === 'undefined' || enabling) return;
        setEnabling(true);
        Notification.requestPermission()
            .then((result) => {
                if (result === 'granted') {
                    const count = badgeCount;
                    if (
                        'setAppBadge' in navigator &&
                        typeof navigator.setAppBadge === 'function'
                    ) {
                        if (count > 0)
                            navigator.setAppBadge(count).catch(() => {});
                        else navigator.clearAppBadge?.().catch(() => {});
                    }
                    window.dispatchEvent(
                        new Event('notification-permission-granted'),
                    );
                }
                setDismissed(true);
                try {
                    sessionStorage.setItem(STANDALONE_KEY, '1');
                } catch {
                    //
                }
            })
            .finally(() => setEnabling(false));
    }, [badgeCount, enabling]);

    const handleDismiss = useCallback(() => {
        setDismissed(true);
        try {
            sessionStorage.setItem(STANDALONE_KEY, '1');
        } catch {
            //
        }
    }, []);

    if (!show) return null;

    return (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-50/90 px-3 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-950/40">
            <Bell className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="min-w-0 flex-1 text-amber-800 dark:text-amber-200">
                To show the count on your home screen icon, enable
                notifications.
            </p>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/60"
                    onClick={handleEnable}
                    disabled={enabling}
                >
                    {enabling ? 'Enabling…' : 'Enable'}
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 p-0 text-amber-700 hover:bg-amber-200/50 dark:text-amber-300 dark:hover:bg-amber-800/50"
                    onClick={handleDismiss}
                    aria-label="Dismiss"
                >
                    <X className="size-4" />
                </Button>
            </div>
        </div>
    );
}
