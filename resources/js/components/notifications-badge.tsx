import { router } from '@inertiajs/react';
import { Bell, CheckCheck, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    isLikelyTransientNetworkError,
    logClientError,
} from '@/lib/client-logger';
import { getCsrfToken } from '@/lib/csrf';
const POLL_VISIBLE_MS = 5000;
const POLL_HIDDEN_MS = 30000;
const FETCH_MS = 15000;
const POLL_BACKOFF_MAX_MS = 120000;

type NotificationRecord = {
    id: number;
    type: string;
    data: Record<string, unknown>;
    created_at: string;
};

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
        }
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch (e) {
        logClientError('notifications.formatTime', e);
        return '';
    }
}

function notificationSummary(n: NotificationRecord): string {
    const data = n.data ?? {};
    if (n.type === 'admin_message') {
        return (
            (data.title as string) ??
            (data.body as string) ??
            (data.message as string) ??
            'Message'
        );
    }
    if (n.type === 'new_offer') {
        return (
            (data.message as string) ??
            'Someone responded to your post — action required.'
        );
    }
    if (n.type === 'swap_accepted') return 'Your response was accepted.';
    if (n.type === 'swap_rejected') return 'Your offer was declined.';
    if (n.type === 'looking_for_work_offer')
        return (
            (data.message as string) ??
            'Someone offered a shift on your looking-for-work post.'
        );
    if (n.type === 'looking_for_work_accepted')
        return 'Your offer was accepted. The shift has been transferred to you.';
    if (n.type === 'looking_for_work_not_selected')
        return 'Another offer was accepted on the post you responded to.';
    if (n.type === 'offer_outside_payback')
        return (
            (data.message as string) ??
            'Offered shift is outside your payback date ranges.'
        );
    return (data.message as string) ?? 'New notification';
}

function basePollMs(): number {
    return document.visibilityState === 'visible'
        ? POLL_VISIBLE_MS
        : POLL_HIDDEN_MS;
}

export function NotificationsBadge() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<NotificationRecord[]>(
        [],
    );
    const [open, setOpen] = useState(false);
    const [messagePopup, setMessagePopup] = useState<{
        title: string;
        body: string;
    } | null>(null);
    const [markingId, setMarkingId] = useState<number | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [pollIntervalMs, setPollIntervalMs] = useState(POLL_VISIBLE_MS);

    const fetchUnread = useCallback(async () => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), FETCH_MS);
        try {
            const res = await fetch('/api/notifications/unread', {
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
            });
            window.clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.unread_count ?? 0);
                setNotifications(
                    Array.isArray(data.notifications) ? data.notifications : [],
                );
                setPollIntervalMs(basePollMs());
            } else {
                setPollIntervalMs((m) =>
                    Math.min(
                        Math.max(m, POLL_VISIBLE_MS) * 2,
                        POLL_BACKOFF_MAX_MS,
                    ),
                );
            }
        } catch (e) {
            window.clearTimeout(timeoutId);
            setPollIntervalMs((m) =>
                Math.min(Math.max(m, POLL_VISIBLE_MS) * 2, POLL_BACKOFF_MAX_MS),
            );
            if (!isLikelyTransientNetworkError(e)) {
                logClientError('notifications.fetchUnread', e);
            }
        }
    }, []);

    useEffect(() => {
        const run = () => {
            void fetchUnread();
        };
        const t = setTimeout(run, 0);
        const intervalId = setInterval(run, pollIntervalMs);
        const handleVisibilityChange = () => {
            setPollIntervalMs(basePollMs());
            if (document.visibilityState === 'visible') run();
        };
        const handleNotificationsUpdated = () => run();
        window.addEventListener(
            'notifications-updated',
            handleNotificationsUpdated,
        );
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearTimeout(t);
            clearInterval(intervalId);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            window.removeEventListener(
                'notifications-updated',
                handleNotificationsUpdated,
            );
        };
    }, [fetchUnread, pollIntervalMs]);

    useEffect(() => {
        if (open) void fetchUnread();
    }, [open, fetchUnread]);

    const markRead = useCallback(async (id: number) => {
        setMarkingId(id);
        try {
            const res = await fetch(`/api/notifications/${id}/read`, {
                method: 'PATCH',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
            });
            if (res.ok) {
                setUnreadCount((c) => Math.max(0, c - 1));
                setNotifications((prev) => prev.filter((n) => n.id !== id));
                window.dispatchEvent(new Event('notifications-updated'));
            }
        } catch (e) {
            logClientError('notifications.markRead', e);
        } finally {
            setMarkingId(null);
        }
    }, []);

    const markAllRead = useCallback(async () => {
        setMarkingAll(true);
        try {
            const res = await fetch('/api/notifications/read-all', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
            });
            if (res.ok) {
                setUnreadCount(0);
                setNotifications([]);
                window.dispatchEvent(new Event('notifications-updated'));
            }
        } catch (e) {
            logClientError('notifications.markAllRead', e);
        } finally {
            setMarkingAll(false);
        }
    }, []);

    const handleNotificationClick = useCallback(
        async (n: NotificationRecord) => {
            if (n.type === 'admin_message') {
                const data = n.data ?? {};
                const title = (data.title as string) ?? 'Message';
                const body =
                    (data.body as string) ?? (data.message as string) ?? '';
                setMessagePopup({ title, body });
                await markRead(n.id);
                setOpen(false);
                return;
            }
            if (n.type === 'new_offer' || n.type === 'offer_outside_payback') {
                const offerId = n.data?.swap_offer_id as number | undefined;
                if (offerId != null) {
                    await markRead(n.id);
                    setOpen(false);
                    router.visit(`/app?open_offer=${offerId}`);
                    return;
                }
            }
            await markRead(n.id);
            setOpen(false);
            router.visit('/app');
        },
        [markRead],
    );

    return (
        <>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        data-tour="notifications-bell"
                        className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={
                            unreadCount > 0
                                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                                : 'Notifications'
                        }
                    >
                        <Bell className="size-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                        <span className="text-sm font-medium">
                            Notifications
                        </span>
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => void markAllRead()}
                                disabled={markingAll}
                            >
                                <CheckCheck className="mr-1 size-3.5" />
                                {markingAll ? '…' : 'Mark all read'}
                            </Button>
                        )}
                    </div>
                    <div className="max-h-[min(60vh,320px)] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                No unread notifications
                            </div>
                        ) : (
                            <ul className="py-1">
                                {notifications.map((n) => (
                                    <DropdownMenuItem
                                        key={n.id}
                                        className="flex cursor-pointer flex-col items-start gap-0.5 py-2.5 pr-3"
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            void handleNotificationClick(n);
                                        }}
                                    >
                                        <div className="flex w-full items-start justify-between gap-2">
                                            <span className="line-clamp-2 text-left text-sm">
                                                {notificationSummary(n)}
                                            </span>
                                            {markingId === n.id ? (
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    …
                                                </span>
                                            ) : (
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    {formatTime(n.created_at)}
                                                </span>
                                            )}
                                        </div>
                                        {n.type === 'admin_message' && (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MessageSquare className="size-3" />
                                                Click to view
                                            </span>
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </ul>
                        )}
                    </div>
                    <DropdownMenuSeparator />
                    <div className="p-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-center text-sm"
                            onClick={() => {
                                setOpen(false);
                                router.visit('/app/notifications');
                            }}
                        >
                            View all notifications
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog
                open={!!messagePopup}
                onOpenChange={(open) => !open && setMessagePopup(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {messagePopup?.title ?? 'Message'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {messagePopup?.body ?? ''}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
