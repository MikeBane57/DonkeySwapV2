import { router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

const POLL_VISIBLE_MS = 5000;
const POLL_HIDDEN_MS = 30000;

export function NotificationsBadge() {
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnread = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications/unread', {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.unread_count ?? 0);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        const run = () => { void fetchUnread(); };
        const t = setTimeout(run, 0);

        let intervalId: ReturnType<typeof setInterval>;

        const schedulePoll = () => {
            clearInterval(intervalId);
            const ms = document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
            intervalId = setInterval(run, ms);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') run();
            schedulePoll();
        };

        const handleNotificationsUpdated = () => run();

        window.addEventListener('notifications-updated', handleNotificationsUpdated);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        schedulePoll();

        return () => {
            clearTimeout(t);
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('notifications-updated', handleNotificationsUpdated);
        };
    }, [fetchUnread]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        router.visit('/app/notifications');
    };

    if (unreadCount === 0) return null;

    return (
        <a
            href="/app/notifications"
            onClick={handleClick}
            className="relative z-10 flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-red-500 px-2 text-[10px] font-medium text-white no-underline transition-opacity hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        >
            {unreadCount > 99 ? '99+' : unreadCount}
        </a>
    );
}
