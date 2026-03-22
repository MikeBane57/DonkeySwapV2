import { Head, router, usePage } from '@inertiajs/react';
import { MessageSquare, Bell, Send, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { getCsrfToken } from '@/lib/csrf';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Message Center', href: '/app/admin/message-center' },
];

type RecipientInfo = { id: number; name: string };

type BannerRow = {
    id: number;
    title: string;
    body: string;
    target_type: string;
    target_workgroup_id: number | null;
    target_workgroup_name: string | null;
    created_by_name: string | null;
    created_at: string | null;
    recipient_count: number;
    active_at_start: string | null;
    active_at_end: string | null;
    status: 'scheduled' | 'active' | 'expired';
    acknowledged: RecipientInfo[];
    not_acknowledged: RecipientInfo[];
};

type NotificationBatchRow = {
    id: number;
    title: string;
    body: string;
    created_by_name: string | null;
    created_at: string | null;
    recipient_count: number;
    active_at_start: string | null;
    active_at_end: string | null;
    status: 'scheduled' | 'active' | 'expired';
    read: RecipientInfo[];
    unread: RecipientInfo[];
};

type UserOption = { id: number; name: string; email: string };
type WorkgroupOption = { id: number; name: string };

type UserNotification = {
    id: number;
    type: string;
    created_at: string | null;
    read_at: string | null;
    title?: string | null;
    message?: string | null;
};

function formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
        return iso;
    }
}

function statusLabel(status: 'scheduled' | 'active' | 'expired'): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: 'scheduled' | 'active' | 'expired'): string {
    switch (status) {
        case 'scheduled':
            return 'bg-slate-500/20 text-slate-700 dark:text-slate-300';
        case 'active':
            return 'bg-green-500/20 text-green-700 dark:text-green-300';
        case 'expired':
            return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
        default:
            return '';
    }
}

export default function AdminMessageCenter() {
    const props = usePage().props as unknown as {
        banners?: BannerRow[];
        notificationBatches?: NotificationBatchRow[];
        users?: UserOption[];
        workgroups?: WorkgroupOption[];
        flash?: { success?: string; error?: string };
        errors?: Record<string, string>;
    };
    const banners = props.banners ?? [];
    const notificationBatches = props.notificationBatches ?? [];
    const users = useMemo(() => props.users ?? [], [props.users]);
    const workgroups = props.workgroups ?? [];
    const flash = props.flash;
    const errors = props.errors ?? {};

    const [delivery, setDelivery] = useState<'banner' | 'notification'>('banner');
    const [targetType, setTargetType] = useState<'all' | 'workgroup' | 'individual'>('all');
    const [targetWorkgroupId, setTargetWorkgroupId] = useState<string>('');
    const [targetUserIds, setTargetUserIds] = useState<number[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [activeAtStart, setActiveAtStart] = useState('');
    const [activeAtEnd, setActiveAtEnd] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [deletingBannerId, setDeletingBannerId] = useState<number | null>(null);
    const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
    const [selectedBannerIds, setSelectedBannerIds] = useState<number[]>([]);
    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
    const [bulkDeletingBanners, setBulkDeletingBanners] = useState(false);
    const [bulkDeletingBatches, setBulkDeletingBatches] = useState(false);
    const [expandedBannerId, setExpandedBannerId] = useState<number | null>(null);
    const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
    const [userNotificationsLoading, setUserNotificationsLoading] = useState(false);
    const [userNotificationSearch, setUserNotificationSearch] = useState('');
    const [clearingBadgeUserId, setClearingBadgeUserId] = useState<number | null>(null);
    const [pushingNotificationId, setPushingNotificationId] = useState<number | null>(null);
    const [deletingNotificationId, setDeletingNotificationId] = useState<number | null>(null);

    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return users;
        const q = userSearch.trim().toLowerCase();
        return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }, [users, userSearch]);

    const filteredUserNotifications = useMemo(() => {
        if (!userNotificationSearch.trim()) return userNotifications;
        const q = userNotificationSearch.trim().toLowerCase();
        return userNotifications.filter((n) => {
            const type = n.type.toLowerCase();
            const title = (n.title ?? '').toLowerCase();
            const message = (n.message ?? '').toLowerCase();
            return type.includes(q) || title.includes(q) || message.includes(q);
        });
    }, [userNotifications, userNotificationSearch]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        const payload: Record<string, unknown> = {
            delivery,
            target_type: targetType,
            title: title.trim(),
            body: body.trim(),
        };
        if (targetType === 'workgroup' && targetWorkgroupId) {
            payload.target_workgroup_id = targetWorkgroupId;
        }
        if (targetType === 'individual' && targetUserIds.length > 0) {
            payload.target_user_ids = targetUserIds;
        }
        if (activeAtStart) payload.active_at_start = activeAtStart;
        if (activeAtEnd) payload.active_at_end = activeAtEnd;
        router.post('/app/admin/message-center', payload, {
            preserveScroll: true,
            onFinish: () => setSending(false),
        });
    };

    const toggleUser = (id: number) => {
        setTargetUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const loadUserNotifications = async (userId: number) => {
        setSelectedUserId(userId);
        setUserNotifications([]);
        setUserNotificationSearch('');
        setUserNotificationsLoading(true);
        try {
            const res = await fetch(`/app/admin/message-center/users/${userId}/notifications`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setUserNotifications(Array.isArray(data.notifications) ? data.notifications : []);
            }
        } finally {
            setUserNotificationsLoading(false);
        }
    };

    const clearBadgeForUser = async (userId: number) => {
        if (!confirm('Send a badge-clear push for this user? This will attempt to clear their app icon badge.')) return;
        setClearingBadgeUserId(userId);
        try {
            await fetch(`/app/admin/message-center/users/${userId}/notifications/clear-badge`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
            });
        } finally {
            setClearingBadgeUserId(null);
        }
    };

    const pushNotification = async (notificationId: number) => {
        setPushingNotificationId(notificationId);
        try {
            await fetch(`/app/admin/message-center/notifications/${notificationId}/push`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
            });
        } finally {
            setPushingNotificationId(null);
        }
    };

    const deleteNotification = async (notificationId: number) => {
        if (!confirm('Delete this notification for the user?')) return;
        setDeletingNotificationId(notificationId);
        try {
            const res = await fetch(`/app/admin/message-center/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
            });
            if (res.ok) {
                setUserNotifications((prev) => prev.filter((n) => n.id !== notificationId));
            }
        } finally {
            setDeletingNotificationId(null);
        }
    };

    const deleteBanner = (id: number) => {
        if (!confirm('Delete this banner message? Recipients will no longer see it.')) return;
        setDeletingBannerId(id);
        router.delete(`/app/admin/message-center/banners/${id}`, {
            preserveScroll: true,
            onFinish: () => setDeletingBannerId(null),
        });
    };

    const deleteNotificationBatch = (id: number) => {
        if (!confirm('Delete this notification batch? Notifications will be removed for all recipients.')) return;
        setDeletingBatchId(id);
        router.delete(`/app/admin/message-center/notification-batches/${id}`, {
            preserveScroll: true,
            onFinish: () => setDeletingBatchId(null),
        });
    };

    const allBannersSelected = banners.length > 0 && selectedBannerIds.length === banners.length;
    const allBatchesSelected = notificationBatches.length > 0 && selectedBatchIds.length === notificationBatches.length;

    const toggleBannerSelect = (id: number) => {
        setSelectedBannerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
    const toggleBatchSelect = (id: number) => {
        setSelectedBatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
    const toggleSelectAllBanners = () => {
        if (allBannersSelected) setSelectedBannerIds([]);
        else setSelectedBannerIds(banners.map((b) => b.id));
    };
    const toggleSelectAllBatches = () => {
        if (allBatchesSelected) setSelectedBatchIds([]);
        else setSelectedBatchIds(notificationBatches.map((b) => b.id));
    };

    const bulkDeleteBanners = () => {
        if (selectedBannerIds.length === 0) return;
        if (
            !confirm(
                `Delete ${selectedBannerIds.length} banner message(s)? Recipients will no longer see them.`,
            )
        )
            return;
        setBulkDeletingBanners(true);
        router.post(
            '/app/admin/message-center/banners/bulk-destroy',
            { ids: selectedBannerIds },
            {
                preserveScroll: true,
                onFinish: () => {
                    setBulkDeletingBanners(false);
                    setSelectedBannerIds([]);
                },
            },
        );
    };

    const bulkDeleteBatches = () => {
        if (selectedBatchIds.length === 0) return;
        if (
            !confirm(
                `Delete ${selectedBatchIds.length} notification batch(es)? Notifications will be removed for all recipients.`,
            )
        )
            return;
        setBulkDeletingBatches(true);
        router.post(
            '/app/admin/message-center/notification-batches/bulk-destroy',
            { ids: selectedBatchIds },
            {
                preserveScroll: true,
                onFinish: () => {
                    setBulkDeletingBatches(false);
                    setSelectedBatchIds([]);
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Message Center - Admin" />
            <div className="p-4 space-y-8">
                <div>
                    <h1 className="text-2xl font-semibold">Message Center</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Send a <strong>banner</strong> (shown at top of dashboard until acknowledged) or a <strong>notification</strong> (appears in the bell only).
                    </p>
                </div>

                {flash?.success && (
                    <div className="rounded-lg border border-green-500/50 bg-green-50 px-4 py-2 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-200">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-lg border border-red-500/50 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
                        {flash.error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="rounded-xl border border-sidebar-border/70 bg-card p-6 space-y-6 dark:border-sidebar-border">
                    <div className="space-y-2">
                        <Label>Delivery type</Label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="delivery"
                                    checked={delivery === 'banner'}
                                    onChange={() => setDelivery('banner')}
                                    className="rounded-full border-sidebar-border"
                                />
                                <MessageSquare className="size-4 text-amber-600" />
                                <span>Banner — shown at top of dashboard until user dismisses</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="delivery"
                                    checked={delivery === 'notification'}
                                    onChange={() => setDelivery('notification')}
                                    className="rounded-full border-sidebar-border"
                                />
                                <Bell className="size-4 text-blue-600" />
                                <span>Notification — appears in notification bell only</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Recipients</Label>
                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="target"
                                    checked={targetType === 'all'}
                                    onChange={() => setTargetType('all')}
                                    className="rounded-full border-sidebar-border"
                                />
                                All users
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="target"
                                    checked={targetType === 'workgroup'}
                                    onChange={() => setTargetType('workgroup')}
                                    className="rounded-full border-sidebar-border"
                                />
                                Workgroup
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="target"
                                    checked={targetType === 'individual'}
                                    onChange={() => setTargetType('individual')}
                                    className="rounded-full border-sidebar-border"
                                />
                                Individual users
                            </label>
                        </div>
                        {targetType === 'workgroup' && (
                            <Select value={targetWorkgroupId || undefined} onValueChange={setTargetWorkgroupId}>
                                <SelectTrigger className="max-w-xs mt-2">
                                    <SelectValue placeholder="Select workgroup" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workgroups.map((wg) => (
                                        <SelectItem key={wg.id} value={String(wg.id)}>
                                            {wg.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {targetType === 'individual' && (
                            <div className="mt-2 space-y-2">
                                <div className="relative max-w-xs">
                                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search by name or email…"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        className="pl-8 h-9"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto rounded-lg border border-sidebar-border/70 p-2 space-y-1 dark:border-sidebar-border">
                                    {filteredUsers.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-1">No users match your search.</p>
                                    ) : (
                                        filteredUsers.map((u) => (
                                            <label key={u.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                <Checkbox
                                                    checked={targetUserIds.includes(u.id)}
                                                    onCheckedChange={() => toggleUser(u.id)}
                                                />
                                                <span>{u.name}</span>
                                                <span className="text-muted-foreground">({u.email})</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                        {errors.target && (
                            <p className="text-sm text-destructive">{errors.target}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="message-title">Title</Label>
                        <Input
                            id="message-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Message title"
                            maxLength={255}
                            className="max-w-md"
                        />
                        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="message-body">Message</Label>
                        <Textarea
                            id="message-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Message body"
                            rows={4}
                            className="max-w-2xl"
                            maxLength={10000}
                        />
                        {errors.body && <p className="text-sm text-destructive">{errors.body}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Active date / time range (optional)</Label>
                        <p className="text-xs text-muted-foreground">
                            When set, the message is <strong>scheduled</strong> before the start time, <strong>active</strong> between start and end, and <strong>expired</strong> after the end time.
                        </p>
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">Active from</Label>
                                <Input
                                    type="datetime-local"
                                    className="mt-0.5 max-w-[220px]"
                                    value={activeAtStart}
                                    onChange={(e) => setActiveAtStart(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Active until</Label>
                                <Input
                                    type="datetime-local"
                                    className="mt-0.5 max-w-[220px]"
                                    value={activeAtEnd}
                                    onChange={(e) => setActiveAtEnd(e.target.value)}
                                />
                            </div>
                        </div>
                        {(errors.active_at_start || errors.active_at_end) && (
                            <p className="text-sm text-destructive">{errors.active_at_start ?? errors.active_at_end}</p>
                        )}
                    </div>

                    <Button type="submit" disabled={sending}>
                        <Send className="size-4 mr-2" />
                        {sending ? 'Sending…' : 'Send'}
                    </Button>
                </form>

                {/* Per-user notifications & badge controls */}
                <section className="rounded-xl border border-sidebar-border/70 bg-card p-4 space-y-4 dark:border-sidebar-border">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-semibold">User notifications & badges</h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Inspect notifications for a user, resend a push, delete a notification, or clear their app badge via web push.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                value={selectedUserId ?? ''}
                                onChange={(e) => {
                                    const id = e.target.value ? Number(e.target.value) : null;
                                    if (id != null) {
                                        void loadUserNotifications(id);
                                    } else {
                                        setSelectedUserId(null);
                                        setUserNotifications([]);
                                    }
                                }}
                            >
                                <option value="">Select user…</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.email})
                                    </option>
                                ))}
                            </select>
                            {selectedUserId != null && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => clearBadgeForUser(selectedUserId)}
                                    disabled={clearingBadgeUserId === selectedUserId}
                                >
                                    {clearingBadgeUserId === selectedUserId ? 'Clearing…' : 'Clear badge via push'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {selectedUserId != null && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                    Showing up to 200 most recent notifications for the selected user.
                                </p>
                                <Input
                                    type="text"
                                    placeholder="Search type, title, or message…"
                                    value={userNotificationSearch}
                                    onChange={(e) => setUserNotificationSearch(e.target.value)}
                                    className="h-8 w-56 text-xs"
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto rounded-md border border-sidebar-border/60 bg-muted/30 text-xs dark:border-sidebar-border">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                                        <tr>
                                            <th className="px-2 py-1 font-medium">ID</th>
                                            <th className="px-2 py-1 font-medium">Type</th>
                                            <th className="px-2 py-1 font-medium">Created</th>
                                            <th className="px-2 py-1 font-medium">Status</th>
                                            <th className="px-2 py-1 font-medium">Title / Message</th>
                                            <th className="px-2 py-1 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {userNotificationsLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                                                    Loading…
                                                </td>
                                            </tr>
                                        ) : filteredUserNotifications.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                                                    No notifications found for this user.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUserNotifications.map((n) => (
                                                <tr key={n.id} className="border-t border-sidebar-border/40">
                                                    <td className="px-2 py-1 align-top">{n.id}</td>
                                                    <td className="px-2 py-1 align-top">
                                                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                                                            {n.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1 align-top">
                                                        {n.created_at ? formatDateTime(n.created_at) : '—'}
                                                    </td>
                                                    <td className="px-2 py-1 align-top">
                                                        {n.read_at ? (
                                                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                                                                Read
                                                            </span>
                                                        ) : (
                                                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:text-sky-300">
                                                                Unread
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-1 align-top max-w-xs">
                                                        <div className="truncate font-medium">
                                                            {n.title || n.message || '—'}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-1 align-top">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 px-2 text-[10px]"
                                                                onClick={() => pushNotification(n.id)}
                                                                disabled={pushingNotificationId === n.id}
                                                            >
                                                                {pushingNotificationId === n.id ? 'Pushing…' : 'Push again'}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                onClick={() => deleteNotification(n.id)}
                                                                disabled={deletingNotificationId === n.id}
                                                            >
                                                                {deletingNotificationId === n.id ? 'Deleting…' : 'Delete'}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>

                <div>
                    <h2 className="text-lg font-medium mb-3">Banner message history</h2>
                    <p className="text-sm text-muted-foreground mb-3">
                        Expand a row to see who has acknowledged the banner and who has not. You can delete a banner to remove it for everyone.
                    </p>
                    {banners.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={allBannersSelected} onCheckedChange={toggleSelectAllBanners} />
                                Select all
                            </label>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={selectedBannerIds.length === 0 || bulkDeletingBanners}
                                onClick={bulkDeleteBanners}
                            >
                                {bulkDeletingBanners ? 'Deleting…' : `Delete selected (${selectedBannerIds.length})`}
                            </Button>
                        </div>
                    )}
                    {banners.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No banner messages sent yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {banners.map((b) => (
                                <li
                                    key={b.id}
                                    className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden"
                                >
                                    <Collapsible open={expandedBannerId === b.id} onOpenChange={(open) => setExpandedBannerId(open ? b.id : null)}>
                                        <div className="p-3 flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                                <Checkbox
                                                    checked={selectedBannerIds.includes(b.id)}
                                                    onCheckedChange={() => toggleBannerSelect(b.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label={`Select banner ${b.title}`}
                                                />
                                                <CollapsibleTrigger asChild>
                                                    <button type="button" className="p-0.5 rounded hover:bg-muted/50 -m-0.5">
                                                        {expandedBannerId === b.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                    </button>
                                                </CollapsibleTrigger>
                                                <span className="font-medium">{b.title}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${statusClass(b.status)}`}>{statusLabel(b.status)}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {b.target_type === 'all' && 'All users'}
                                                    {b.target_type === 'workgroup' && (b.target_workgroup_name ? `Workgroup: ${b.target_workgroup_name}` : 'Workgroup')}
                                                    {b.target_type === 'individual' && `${b.recipient_count} user(s)`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-muted-foreground">{formatDateTime(b.created_at)}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => deleteBanner(b.id)}
                                                    disabled={deletingBannerId === b.id}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <CollapsibleContent>
                                            <div className="px-3 pb-3 pt-0 border-t border-sidebar-border/50 space-y-2">
                                                <p className="text-sm text-muted-foreground line-clamp-2">{b.body}</p>
                                                {b.created_by_name && <p className="text-xs text-muted-foreground">Sent by {b.created_by_name}</p>}
                                                {(b.active_at_start || b.active_at_end) && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Active: {b.active_at_start ? formatDateTime(b.active_at_start) : '—'} until {b.active_at_end ? formatDateTime(b.active_at_end) : '—'}
                                                    </p>
                                                )}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <span className="font-medium text-muted-foreground">Acknowledged ({b.acknowledged.length})</span>
                                                        <ul className="mt-0.5 text-muted-foreground">
                                                            {b.acknowledged.length === 0 ? <li>—</li> : b.acknowledged.map((u) => <li key={u.id}>{u.name}</li>)}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-muted-foreground">Not acknowledged ({b.not_acknowledged.length})</span>
                                                        <ul className="mt-0.5 text-muted-foreground">
                                                            {b.not_acknowledged.length === 0 ? <li>—</li> : b.not_acknowledged.map((u) => <li key={u.id}>{u.name}</li>)}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div>
                    <h2 className="text-lg font-medium mb-3">Notification message history</h2>
                    <p className="text-sm text-muted-foreground mb-3">
                        Batches sent to the notification bell. Expand to see who has read and who has not. Deleting removes the notifications for all recipients.
                    </p>
                    {notificationBatches.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={allBatchesSelected} onCheckedChange={toggleSelectAllBatches} />
                                Select all
                            </label>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={selectedBatchIds.length === 0 || bulkDeletingBatches}
                                onClick={bulkDeleteBatches}
                            >
                                {bulkDeletingBatches ? 'Deleting…' : `Delete selected (${selectedBatchIds.length})`}
                            </Button>
                        </div>
                    )}
                    {notificationBatches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No notification batches sent yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {notificationBatches.map((nb) => (
                                <li
                                    key={nb.id}
                                    className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden"
                                >
                                    <Collapsible open={expandedBatchId === nb.id} onOpenChange={(open) => setExpandedBatchId(open ? nb.id : null)}>
                                        <div className="p-3 flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                                <Checkbox
                                                    checked={selectedBatchIds.includes(nb.id)}
                                                    onCheckedChange={() => toggleBatchSelect(nb.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label={`Select notification batch ${nb.title}`}
                                                />
                                                <CollapsibleTrigger asChild>
                                                    <button type="button" className="p-0.5 rounded hover:bg-muted/50 -m-0.5">
                                                        {expandedBatchId === nb.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                    </button>
                                                </CollapsibleTrigger>
                                                <span className="font-medium">{nb.title}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${statusClass(nb.status)}`}>{statusLabel(nb.status)}</span>
                                                <span className="text-xs text-muted-foreground">{nb.recipient_count} recipient(s)</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-muted-foreground">{formatDateTime(nb.created_at)}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => deleteNotificationBatch(nb.id)}
                                                    disabled={deletingBatchId === nb.id}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <CollapsibleContent>
                                            <div className="px-3 pb-3 pt-0 border-t border-sidebar-border/50 space-y-2">
                                                <p className="text-sm text-muted-foreground line-clamp-2">{nb.body}</p>
                                                {nb.created_by_name && <p className="text-xs text-muted-foreground">Sent by {nb.created_by_name}</p>}
                                                {(nb.active_at_start || nb.active_at_end) && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Active: {nb.active_at_start ? formatDateTime(nb.active_at_start) : '—'} until {nb.active_at_end ? formatDateTime(nb.active_at_end) : '—'}
                                                    </p>
                                                )}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <span className="font-medium text-muted-foreground">Read ({nb.read.length})</span>
                                                        <ul className="mt-0.5 text-muted-foreground">
                                                            {nb.read.length === 0 ? <li>—</li> : nb.read.map((u) => <li key={u.id}>{u.name}</li>)}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-muted-foreground">Unread ({nb.unread.length})</span>
                                                        <ul className="mt-0.5 text-muted-foreground">
                                                            {nb.unread.length === 0 ? <li>—</li> : nb.unread.map((u) => <li key={u.id}>{u.name}</li>)}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
