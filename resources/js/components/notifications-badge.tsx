import { router } from '@inertiajs/react';
import { Bell } from 'lucide-react';
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

    return (
        <a
            href="/app/notifications"
            onClick={handleClick}
            className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'Notifications'}
        >
            <Bell className="size-5" />
            {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </a>
    );
}
