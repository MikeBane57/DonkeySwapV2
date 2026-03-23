import { Head, Link, router, usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Analytics', href: '/app/admin/analytics' },
];

type DailyRow = {
    date: string;
    swap_posts_created: number;
    swap_posts_resolved: number;
    swap_avg_resolve_hours: number | null;
    swap_offers_created: number;
    lfw_posts_created: number;
    lfw_posts_resolved: number;
    lfw_avg_resolve_hours: number | null;
    computed_at: string | null;
};

type ShiftHistRow = {
    shift_date: string;
    swap_post_count: number;
};

type Summary = {
    swap_posts_created: number;
    swap_posts_resolved: number;
    swap_offers_created: number;
    lfw_posts_created: number;
    lfw_posts_resolved: number;
    swap_avg_resolve_hours: number | null;
    lfw_avg_resolve_hours: number | null;
};

type WeekDailyRow = {
    date: string;
    swap_posts_created: number;
    swap_posts_resolved: number;
    swap_avg_resolve_hours: number | null;
    swap_offers_created: number;
    lfw_posts_created: number;
    lfw_posts_resolved: number;
    lfw_avg_resolve_hours: number | null;
};

type WeekLeaderboardRow = {
    rank: number;
    user_id: number;
    name: string;
    email: string;
    employee_id: string | null;
    swap_posts: number;
    swap_offers: number;
    lfw_posts: number;
    activity_total: number;
};

type WeekUserFocus = {
    user: {
        id: number;
        name: string;
        email: string;
        employee_id: string | null;
        role: string | null;
    };
    swap_posts_created: number;
    swap_offers: number;
    lfw_posts_created: number;
    swap_posts_resolved: number;
    lfw_posts_resolved: number;
};

function barHeight(value: number, max: number, pxMax: number): number {
    if (max <= 0) return 0;
    return Math.max(2, Math.round((value / max) * pxMax));
}

function formatHours(h: number | null | undefined): string {
    if (h == null || Number.isNaN(h)) return '—';
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    const rem = Math.round((h % 24) * 10) / 10;
    return `${d}d${rem > 0 ? ` ${rem}h` : ''}`;
}

export default function AdminAnalytics() {
    const page = usePage();
    const {
        timezone = 'UTC',
        window_days = 120,
        daily = [],
        summary,
        week_range,
        week_summary,
        week_daily = [],
        has_week_data = false,
        week_user_leaderboard = [],
        week_user_focus = null,
        week_user_invalid = false,
        week_user_id = null,
        shift_histogram = [],
        shift_histogram_as_of = null,
        shift_histogram_as_of_options = [],
        has_daily_data = false,
    } = page.props as {
        timezone?: string;
        window_days?: number;
        daily?: DailyRow[];
        summary?: Summary;
        week_range?: { start: string; end: string };
        week_summary?: Summary;
        week_daily?: WeekDailyRow[];
        has_week_data?: boolean;
        week_user_leaderboard?: WeekLeaderboardRow[];
        week_user_focus?: WeekUserFocus | null;
        week_user_invalid?: boolean;
        week_user_id?: number | null;
        shift_histogram?: ShiftHistRow[];
        shift_histogram_as_of?: string | null;
        shift_histogram_as_of_options?: string[];
        has_daily_data?: boolean;
    };

    const maxSwapDay = useMemo(
        () =>
            Math.max(
                1,
                ...daily.map((d) =>
                    Math.max(d.swap_posts_created, d.swap_posts_resolved),
                ),
            ),
        [daily],
    );
    const maxShiftCount = useMemo(
        () => Math.max(1, ...shift_histogram.map((s) => s.swap_post_count)),
        [shift_histogram],
    );
    const maxWeekSwap = useMemo(
        () =>
            Math.max(
                1,
                ...week_daily.map((d) =>
                    Math.max(d.swap_posts_created, d.swap_posts_resolved),
                ),
            ),
        [week_daily],
    );

    const buildAnalyticsQuery = (patch: {
        days?: string;
        as_of?: string | null;
        week_user?: number | null;
    }) => {
        const nextDays = patch.days ?? String(window_days);
        const asOf =
            patch.as_of !== undefined ? patch.as_of : shift_histogram_as_of;
        const wu =
            patch.week_user !== undefined ? patch.week_user : week_user_id;
        const q: Record<string, string | number> = { days: nextDays };
        if (asOf && asOf !== '') {
            q.as_of = asOf;
        }
        if (wu != null && wu > 0) {
            q.week_user = wu;
        }
        return q;
    };

    const setDays = (days: string) => {
        router.get('/app/admin/analytics', buildAnalyticsQuery({ days }), {
            preserveScroll: true,
            replace: true,
        });
    };

    const setAsOf = (as_of: string) => {
        router.get(
            '/app/admin/analytics',
            buildAnalyticsQuery({
                as_of: as_of === '__latest__' ? null : as_of,
            }),
            { preserveScroll: true, replace: true },
        );
    };

    const openWeekUserProfile = (userId: number) => {
        router.get(
            '/app/admin/analytics',
            buildAnalyticsQuery({ week_user: userId }),
            {
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const clearWeekUserProfile = () => {
        router.get(
            '/app/admin/analytics',
            buildAnalyticsQuery({ week_user: null }),
            {
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Analytics - Admin" />
            <div className="max-w-6xl space-y-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">Analytics</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Daily rows record counts for each calendar day (rebuilt
                        from source data whenever aggregation runs). Shift
                        histograms keep a separate snapshot for each run date so
                        you can recall older heatmaps. Default view: last{' '}
                        {window_days} days of activity. Times use the app
                        timezone ({timezone}).
                    </p>
                </div>

                {!has_daily_data && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                        No snapshot rows yet. Run{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                            php artisan analytics:aggregate --from=YYYY-MM-DD
                            --to=YYYY-MM-DD
                        </code>{' '}
                        once to backfill, then schedule{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                            analytics:aggregate
                        </code>{' '}
                        daily (already registered) to keep data current.
                    </div>
                )}

                {week_summary && week_range && (
                    <section className="space-y-3">
                        <div>
                            <h2 className="text-lg font-medium">
                                Last 7 days (rolling)
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Calendar days{' '}
                                <span className="font-mono">
                                    {week_range.start}
                                </span>{' '}
                                →{' '}
                                <span className="font-mono">
                                    {week_range.end}
                                </span>{' '}
                                ({timezone}). Totals and weighted averages from
                                daily snapshots—same definitions as below.
                                Per-user stats and the leaderboard are computed
                                live from posts and offers in this date range.
                            </p>
                            {!has_week_data && (
                                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90">
                                    No snapshot rows for these dates yet;
                                    figures stay at zero until aggregation has
                                    run.
                                </p>
                            )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Swap posts (created / resolved)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {week_summary.swap_posts_created}{' '}
                                    <span className="text-muted-foreground">
                                        /
                                    </span>{' '}
                                    {week_summary.swap_posts_resolved}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Week total
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Avg. time to resolve (swap)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {formatHours(
                                        week_summary.swap_avg_resolve_hours,
                                    )}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Weighted across resolved posts this week
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Avg. time to resolve (LFW)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {formatHours(
                                        week_summary.lfw_avg_resolve_hours,
                                    )}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Weighted across resolved posts this week
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Swap offers created
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {week_summary.swap_offers_created}
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    LFW posts (created / resolved)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {week_summary.lfw_posts_created}{' '}
                                    <span className="text-muted-foreground">
                                        /
                                    </span>{' '}
                                    {week_summary.lfw_posts_resolved}
                                </p>
                            </div>
                        </div>
                        {week_daily.length > 0 && (
                            <div className="rounded-xl border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                    Swap activity by day (this week)
                                </p>
                                <div className="flex h-32 items-end justify-between gap-1">
                                    {week_daily.map((d) => (
                                        <div
                                            key={d.date}
                                            className="flex min-w-0 flex-1 flex-col items-center justify-end"
                                            title={`${d.date}: created ${d.swap_posts_created}, resolved ${d.swap_posts_resolved}`}
                                        >
                                            <div className="flex h-28 items-end gap-px">
                                                <div
                                                    className="w-full max-w-10 min-w-[6px] rounded-t bg-primary"
                                                    style={{
                                                        height: barHeight(
                                                            d.swap_posts_created,
                                                            maxWeekSwap,
                                                            108,
                                                        ),
                                                    }}
                                                />
                                                <div
                                                    className="w-full max-w-10 min-w-[6px] rounded-t bg-muted-foreground/45"
                                                    style={{
                                                        height: barHeight(
                                                            d.swap_posts_resolved,
                                                            maxWeekSwap,
                                                            108,
                                                        ),
                                                    }}
                                                />
                                            </div>
                                            <span className="mt-1 truncate text-[10px] text-muted-foreground">
                                                {d.date.slice(5)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="space-y-3">
                            <div>
                                <h3 className="text-base font-medium">
                                    Most active users
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Ranked by total actions: swap posts created
                                    + swap offers made + LFW posts created. Use
                                    &quot;Profile&quot; to see that user&apos;s
                                    counts for this same week (good for building
                                    a behavioral snapshot).
                                </p>
                            </div>
                            {week_user_leaderboard.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No user activity recorded in this window.
                                </p>
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">
                                                    #
                                                </TableHead>
                                                <TableHead>User</TableHead>
                                                <TableHead className="text-right tabular-nums">
                                                    Swap posts
                                                </TableHead>
                                                <TableHead className="text-right tabular-nums">
                                                    Offers
                                                </TableHead>
                                                <TableHead className="text-right tabular-nums">
                                                    LFW
                                                </TableHead>
                                                <TableHead className="text-right tabular-nums">
                                                    Total
                                                </TableHead>
                                                <TableHead className="w-28 text-right">
                                                    {' '}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {week_user_leaderboard.map(
                                                (row) => (
                                                    <TableRow
                                                        key={row.user_id}
                                                        className={cn(
                                                            week_user_id ===
                                                                row.user_id &&
                                                                'bg-muted/50',
                                                        )}
                                                    >
                                                        <TableCell className="text-muted-foreground tabular-nums">
                                                            {row.rank}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">
                                                                {row.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {row.email}
                                                            </div>
                                                            {row.employee_id && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    EMPID{' '}
                                                                    {
                                                                        row.employee_id
                                                                    }
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {row.swap_posts}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {row.swap_offers}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {row.lfw_posts}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium tabular-nums">
                                                            {row.activity_total}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    openWeekUserProfile(
                                                                        row.user_id,
                                                                    )
                                                                }
                                                            >
                                                                Profile
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ),
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                            {week_user_invalid && (
                                <p className="text-sm text-destructive">
                                    No user exists for the selected profile.
                                </p>
                            )}
                            {week_user_focus && (
                                <div className="rounded-xl border border-sidebar-border/70 bg-muted/20 p-4 dark:border-sidebar-border">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <h4 className="font-medium">
                                                {week_user_focus.user.name}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {week_user_focus.user.email}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {week_user_focus.user
                                                    .employee_id && (
                                                    <>
                                                        EMPID{' '}
                                                        {
                                                            week_user_focus.user
                                                                .employee_id
                                                        }{' '}
                                                        ·{' '}
                                                    </>
                                                )}
                                                Role{' '}
                                                {week_user_focus.user.role ??
                                                    '—'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={clearWeekUserProfile}
                                            >
                                                Clear
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                asChild
                                            >
                                                <Link href="/app/admin/users">
                                                    User Manager
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Same rolling week ({week_range?.start} →{' '}
                                        {week_range?.end}). &quot;Resolved&quot;
                                        counts are posts they own that moved to
                                        accepted/closed during this window (by{' '}
                                        <span className="font-mono">
                                            updated_at
                                        </span>
                                        ).
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="rounded-lg border border-sidebar-border/60 bg-background/80 px-3 py-2 dark:border-sidebar-border">
                                            <p className="text-xs text-muted-foreground">
                                                Swap posts created
                                            </p>
                                            <p className="text-lg font-semibold tabular-nums">
                                                {
                                                    week_user_focus.swap_posts_created
                                                }
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-sidebar-border/60 bg-background/80 px-3 py-2 dark:border-sidebar-border">
                                            <p className="text-xs text-muted-foreground">
                                                Swap offers made
                                            </p>
                                            <p className="text-lg font-semibold tabular-nums">
                                                {week_user_focus.swap_offers}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-sidebar-border/60 bg-background/80 px-3 py-2 dark:border-sidebar-border">
                                            <p className="text-xs text-muted-foreground">
                                                LFW posts created
                                            </p>
                                            <p className="text-lg font-semibold tabular-nums">
                                                {
                                                    week_user_focus.lfw_posts_created
                                                }
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-sidebar-border/60 bg-background/80 px-3 py-2 dark:border-sidebar-border">
                                            <p className="text-xs text-muted-foreground">
                                                Their swap posts resolved
                                            </p>
                                            <p className="text-lg font-semibold tabular-nums">
                                                {
                                                    week_user_focus.swap_posts_resolved
                                                }
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-sidebar-border/60 bg-background/80 px-3 py-2 dark:border-sidebar-border">
                                            <p className="text-xs text-muted-foreground">
                                                Their LFW posts resolved
                                            </p>
                                            <p className="text-lg font-semibold tabular-nums">
                                                {
                                                    week_user_focus.lfw_posts_resolved
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {summary && (
                    <section className="space-y-3">
                        <div>
                            <h2 className="text-lg font-medium">
                                Selected period
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Totals and averages for the last {window_days}{' '}
                                days (matches the activity chart below).
                            </p>
                        </div>
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="analytics-days">
                                    Activity window
                                </Label>
                                <Select
                                    value={String(window_days)}
                                    onValueChange={setDays}
                                >
                                    <SelectTrigger
                                        id="analytics-days"
                                        className="w-[200px]"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[7, 30, 60, 90, 120, 180, 365].map(
                                            (d) => (
                                                <SelectItem
                                                    key={d}
                                                    value={String(d)}
                                                >
                                                    Last {d} days
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Swap posts (created / resolved)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {summary.swap_posts_created}{' '}
                                    <span className="text-muted-foreground">
                                        /
                                    </span>{' '}
                                    {summary.swap_posts_resolved}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Period total
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Avg. time to resolve (swap)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {formatHours(
                                        summary.swap_avg_resolve_hours,
                                    )}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Weighted across resolved posts in period
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Avg. time to resolve (LFW)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {formatHours(summary.lfw_avg_resolve_hours)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Weighted across resolved posts in period
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Swap offers created
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {summary.swap_offers_created}
                                </p>
                            </div>
                            <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                <p className="text-xs font-medium text-muted-foreground">
                                    LFW posts (created / resolved)
                                </p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">
                                    {summary.lfw_posts_created}{' '}
                                    <span className="text-muted-foreground">
                                        /
                                    </span>{' '}
                                    {summary.lfw_posts_resolved}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                <section className="space-y-2">
                    <h2 className="text-lg font-medium">
                        Swap activity by calendar day
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Posts created and resolved on each day (UTC-stored
                        timestamps interpreted in {timezone}). Bars: created
                        (solid) vs resolved (muted).
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                        <div className="flex h-44 min-w-max items-end gap-0.5">
                            {daily.map((d) => (
                                <div
                                    key={d.date}
                                    className="flex w-3 flex-col items-center justify-end"
                                    title={`${d.date}: created ${d.swap_posts_created}, resolved ${d.swap_posts_resolved}`}
                                >
                                    <div className="flex h-40 items-end gap-px">
                                        <div
                                            className="w-1.5 rounded-t bg-primary"
                                            style={{
                                                height: barHeight(
                                                    d.swap_posts_created,
                                                    maxSwapDay,
                                                    156,
                                                ),
                                            }}
                                        />
                                        <div
                                            className="w-1.5 rounded-t bg-muted-foreground/45"
                                            style={{
                                                height: barHeight(
                                                    d.swap_posts_resolved,
                                                    maxSwapDay,
                                                    156,
                                                ),
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                            <span>{daily[0]?.date ?? ''}</span>
                            <span>{daily[daily.length - 1]?.date ?? ''}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                            Each day: left bar = posts created, right bar =
                            posts resolved (accepted/closed) that day.
                        </p>
                    </div>
                </section>

                <section className="space-y-2">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <h2 className="text-lg font-medium">
                            Swap posts by shift date (120-day window)
                        </h2>
                        {shift_histogram_as_of_options.length > 0 && (
                            <div className="space-y-1">
                                <Label htmlFor="analytics-as-of">
                                    Histogram snapshot
                                </Label>
                                <Select
                                    value={
                                        shift_histogram_as_of ?? '__latest__'
                                    }
                                    onValueChange={(v) => setAsOf(v)}
                                >
                                    <SelectTrigger
                                        id="analytics-as-of"
                                        className="w-[240px]"
                                    >
                                        <SelectValue placeholder="Latest" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__latest__">
                                            Latest (max date)
                                        </SelectItem>
                                        {shift_histogram_as_of_options.map(
                                            (d) => (
                                                <SelectItem key={d} value={d}>
                                                    {d}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Count of swap posts whose shift starts on each calendar
                        day (local date). Each nightly run stores a full row set
                        for that snapshot date so you can recall older heatmaps
                        from the dropdown above.
                        {shift_histogram_as_of && (
                            <>
                                {' '}
                                Showing snapshot{' '}
                                <span className="font-mono">
                                    {shift_histogram_as_of}
                                </span>
                                .
                            </>
                        )}
                    </p>
                    {shift_histogram.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No histogram rows yet. Run aggregation to populate.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                            <div className="flex h-44 min-w-max items-end gap-px">
                                {shift_histogram.map((s) => (
                                    <div
                                        key={s.shift_date}
                                        className="flex w-2 flex-col items-center justify-end"
                                        title={`${s.shift_date}: ${s.swap_post_count} posts`}
                                    >
                                        <div
                                            className="w-full rounded-t bg-primary/80"
                                            style={{
                                                height: barHeight(
                                                    s.swap_post_count,
                                                    maxShiftCount,
                                                    160,
                                                ),
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                                <span>
                                    {shift_histogram[0]?.shift_date ?? ''}
                                </span>
                                <span>
                                    {shift_histogram[shift_histogram.length - 1]
                                        ?.shift_date ?? ''}
                                </span>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </AppLayout>
    );
}
