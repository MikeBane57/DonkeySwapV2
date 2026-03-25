import { Head, Link, router, usePage } from '@inertiajs/react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { getCsrfToken } from '@/lib/csrf';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/app' },
    { title: 'Notifications', href: '/app/notifications' },
];

const POST_TYPE_LABELS: Record<string, string> = {
    trade: 'Trade',
    time_trade: 'Time trade',
    cash: 'Giveaway',
    flight_follow: 'Flight follow',
};

type PostSummary = {
    post_id: number;
    post_type: string;
    poster_name: string;
    position_name: string;
    start_utc: string | null;
    end_utc: string | null;
    formatted_range: string | null;
};

type OutcomeSummary = {
    offer_id: number;
    other_user_name: string;
    offered_shift_label: string;
};

type NotificationItem = {
    id: number;
    type: string;
    message: string;
    data: Record<string, unknown>;
    created_at: string;
    post_summary?: PostSummary | null;
    outcome_summary?: OutcomeSummary | null;
};

function getOverviewLines(
    data: Record<string, unknown>,
    type: string,
): string[] {
    const lines: string[] = [];
    if (data.message && typeof data.message === 'string') {
        lines.push(data.message);
    }
    if (data.swap_offer_id != null) {
        lines.push(`Offer #${data.swap_offer_id}`);
    }
    if (type === 'swap_accepted') {
        lines.push('Your trade or offer was accepted.');
    } else if (type === 'swap_rejected') {
        lines.push('An offer on your post was declined.');
    }
    return lines.length ? lines : ['No additional details.'];
}

function formatDate(iso: string | null | undefined): string {
    if (iso == null || iso === '') return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
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
    } catch {
        return iso;
    }
}

function formatDateFull(iso: string | null | undefined): string {
    if (iso == null || iso === '') return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

export default function NotificationsPage() {
    const page = usePage();
    const pageProps = page.props as { notifications?: unknown };
    const initialNotifications = Array.isArray(pageProps?.notifications)
        ? (pageProps.notifications as NotificationItem[])
        : [];
    const [notifications, setNotifications] = useState(initialNotifications);
    const [detailNotification, setDetailNotification] =
        useState<NotificationItem | null>(null);
    const [dismissingId, setDismissingId] = useState<number | null>(null);
    const [dismissingAll, setDismissingAll] = useState(false);

    const dismissOne = useCallback(async (id: number) => {
        setDismissingId(id);
        try {
            const res = await fetch(`/api/notifications/${id}/read`, {
                method: 'PATCH',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
            });
            if (res.ok) {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
                setDetailNotification((prev) =>
                    prev?.id === id ? null : prev,
                );
                window.dispatchEvent(new CustomEvent('notifications-updated'));
                router.reload({ only: ['badge_count'] });
            }
        } finally {
            setDismissingId(null);
        }
    }, []);

    const dismissAll = useCallback(async () => {
        setDismissingAll(true);
        try {
            const res = await fetch('/api/notifications/read-all', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
            });
            if (res.ok) {
                setNotifications([]);
                setDetailNotification(null);
                window.dispatchEvent(new CustomEvent('notifications-updated'));
                router.reload({ only: ['notifications', 'badge_count'] });
            }
        } finally {
            setDismissingAll(false);
        }
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Notifications" />
            <div className="min-h-[50vh] flex-1 p-4 md:p-6">
                <div
                    className="mx-auto max-w-2xl"
                    data-tour="notifications-main"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">
                                Notifications
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Unread notifications. Open one for details or
                                dismiss.
                            </p>
                        </div>
                        {notifications.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={dismissAll}
                                disabled={dismissingAll}
                                className="shrink-0"
                            >
                                <CheckCheck className="mr-1.5 size-4" />
                                {dismissingAll
                                    ? 'Dismissing…'
                                    : 'Mark all as read'}
                            </Button>
                        )}
                    </div>

                    {notifications.length === 0 ? (
                        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-sidebar-border/70 bg-card px-4 py-12 dark:border-sidebar-border">
                            <Bell className="size-10 text-muted-foreground/60" />
                            <p className="mt-3 text-sm font-medium text-muted-foreground">
                                No unread notifications
                            </p>
                            <Button variant="outline" className="mt-4" asChild>
                                <Link href="/app">Go to Dashboard</Link>
                            </Button>
                        </div>
                    ) : (
                        <ul className="mt-6 space-y-2">
                            {notifications.map((n) => (
                                <li key={n.id}>
                                    <div className="flex items-start gap-2 rounded-xl border border-sidebar-border/70 bg-card transition-colors dark:border-sidebar-border">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setDetailNotification(n)
                                            }
                                            className="min-w-0 flex-1 rounded-xl p-4 text-left transition-colors hover:bg-muted/50 dark:hover:bg-muted/30"
                                        >
                                            <p className="text-sm font-medium">
                                                {n.message}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {formatDate(n.created_at)}
                                            </p>
                                            {n.type === 'admin_message' &&
                                                (n.data?.reconciliation_id ??
                                                    n.data?.reconcile_url) && (
                                                    <p className="mt-1.5">
                                                        <Link
                                                            href={
                                                                (n.data
                                                                    ?.reconcile_url as string) ||
                                                                '/app/reconcile-schedule'
                                                            }
                                                            className="text-sm font-medium text-primary hover:underline"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        >
                                                            Review changes →
                                                        </Link>
                                                    </p>
                                                )}
                                        </button>
                                        <div className="flex shrink-0 items-center p-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    dismissOne(n.id);
                                                }}
                                                disabled={dismissingId === n.id}
                                                title="Dismiss"
                                            >
                                                {dismissingId === n.id ? (
                                                    <span className="text-xs">
                                                        …
                                                    </span>
                                                ) : (
                                                    <Check className="size-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <Dialog
                open={!!detailNotification}
                onOpenChange={(open) => !open && setDetailNotification(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Notification details</DialogTitle>
                    </DialogHeader>
                    {detailNotification && (
                        <div className="space-y-4">
                            <p className="text-sm font-medium">
                                {detailNotification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {formatDateFull(detailNotification.created_at)}
                            </p>

                            {detailNotification.post_summary && (
                                <div className="rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 dark:border-sidebar-border">
                                    <p className="text-sm font-medium">
                                        {POST_TYPE_LABELS[
                                            detailNotification.post_summary
                                                .post_type
                                        ] ??
                                            detailNotification.post_summary
                                                .post_type}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {
                                            detailNotification.post_summary
                                                .position_name
                                        }
                                        {detailNotification.post_summary
                                            .formatted_range
                                            ? ` · ${detailNotification.post_summary.formatted_range}`
                                            : ''}
                                    </p>
                                </div>
                            )}

                            <div className="rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 dark:border-sidebar-border">
                                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    What happened
                                </p>
                                {detailNotification.outcome_summary ? (
                                    <>
                                        <p className="text-sm">
                                            {detailNotification.type ===
                                                'swap_accepted' &&
                                                ([
                                                    'cash',
                                                    'flight_follow',
                                                ].includes(
                                                    detailNotification
                                                        .post_summary
                                                        ?.post_type ?? '',
                                                ) ? (
                                                    <>
                                                        <strong>
                                                            {detailNotification
                                                                .post_summary
                                                                ?.poster_name ??
                                                                'The posting user'}
                                                        </strong>{' '}
                                                        gave you the shift.
                                                    </>
                                                ) : (
                                                    <>
                                                        <strong>
                                                            {
                                                                detailNotification
                                                                    .outcome_summary
                                                                    .other_user_name
                                                            }
                                                        </strong>{' '}
                                                        offered{' '}
                                                        {
                                                            detailNotification
                                                                .outcome_summary
                                                                .offered_shift_label
                                                        }
                                                        . Your trade was
                                                        accepted.
                                                    </>
                                                ))}
                                            {detailNotification.type ===
                                                'swap_rejected' && (
                                                <>
                                                    An offer from{' '}
                                                    <strong>
                                                        {
                                                            detailNotification
                                                                .outcome_summary
                                                                .other_user_name
                                                        }
                                                    </strong>{' '}
                                                    (
                                                    {
                                                        detailNotification
                                                            .outcome_summary
                                                            .offered_shift_label
                                                    }
                                                    ) on this post was declined.
                                                </>
                                            )}
                                            {![
                                                'swap_accepted',
                                                'swap_rejected',
                                            ].includes(
                                                detailNotification.type,
                                            ) && (
                                                <>
                                                    <strong>
                                                        {
                                                            detailNotification
                                                                .outcome_summary
                                                                .other_user_name
                                                        }
                                                    </strong>{' '}
                                                    offered{' '}
                                                    {
                                                        detailNotification
                                                            .outcome_summary
                                                            .offered_shift_label
                                                    }
                                                    .
                                                    {detailNotification.type ===
                                                        'offer_outside_payback' &&
                                                        detailNotification.message && (
                                                            <span className="mt-2 block font-medium text-amber-600 dark:text-amber-400">
                                                                {
                                                                    detailNotification.message
                                                                }
                                                            </span>
                                                        )}
                                                </>
                                            )}
                                        </p>
                                        {detailNotification.type ===
                                            'swap_accepted' && (
                                            <p className="mt-2 text-sm font-medium text-muted-foreground">
                                                Please check workzone to ensure
                                                the change has been made
                                                properly.
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <ul className="list-inside list-disc space-y-1 text-sm">
                                        {getOverviewLines(
                                            detailNotification.data,
                                            detailNotification.type,
                                        ).map((line, i) => (
                                            <li key={i}>{line}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {detailNotification.type === 'admin_message' &&
                                (detailNotification.data?.reconciliation_id ??
                                    detailNotification.data?.reconcile_url) ? (
                                    <Button size="sm" asChild>
                                        <Link
                                            href={
                                                (detailNotification.data
                                                    ?.reconcile_url as string) ||
                                                '/app/reconcile-schedule'
                                            }
                                            onClick={() =>
                                                setDetailNotification(null)
                                            }
                                        >
                                            Review changes
                                        </Link>
                                    </Button>
                                ) : null}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setDetailNotification(null);
                                        dismissOne(detailNotification.id);
                                    }}
                                    disabled={
                                        dismissingId === detailNotification.id
                                    }
                                >
                                    <Check className="mr-1.5 size-4" />
                                    Dismiss
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                    <Link
                                        href="/app"
                                        onClick={() =>
                                            setDetailNotification(null)
                                        }
                                    >
                                        Go to Dashboard
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
