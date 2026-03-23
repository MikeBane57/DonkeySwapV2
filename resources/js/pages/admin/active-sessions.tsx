import { Head, router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Active sessions', href: '/app/admin/active-sessions' },
];

type SessionRow = {
    session_id: string;
    user_id: number;
    user_name: string;
    user_email: string;
    ip_address: string | null;
    browser: string;
    os: string;
    platform: string;
    display_mode: string | null;
    is_installed_web_app: boolean;
    last_activity_at: string;
    last_activity_human: string;
    is_current: boolean;
};

type Rollup = {
    by_browser: Record<string, number>;
    by_os: Record<string, number>;
    by_display_mode: Record<string, number>;
};

function displayModeLabel(mode: string | null): string {
    if (mode === null || mode === 'unknown') {
        return 'Unknown';
    }
    switch (mode) {
        case 'standalone':
            return 'Installed (PWA)';
        case 'minimal-ui':
            return 'Minimal UI';
        case 'fullscreen':
            return 'Fullscreen';
        case 'browser':
            return 'Browser tab';
        default:
            return mode;
    }
}

function RollupList({
    title,
    data,
}: {
    title: string;
    data: Record<string, number>;
}) {
    const entries = useMemo(
        () => Object.entries(data).sort((a, b) => b[1] - a[1]),
        [data],
    );
    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
            <h3 className="text-sm font-medium">{title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {entries.map(([k, n]) => (
                    <li key={k} className="flex justify-between gap-4">
                        <span className="min-w-0 truncate">{k}</span>
                        <span className="shrink-0 text-foreground tabular-nums">
                            {n}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function AdminActiveSessions({
    sessions_unavailable,
    sessions_unavailable_reason,
    timezone,
    session_lifetime_minutes,
    rows,
    rollup,
    total,
}: {
    sessions_unavailable: boolean;
    sessions_unavailable_reason: string | null;
    timezone: string;
    session_lifetime_minutes: number;
    rows: SessionRow[];
    rollup: Rollup;
    total: number;
}) {
    const handleRefresh = () => {
        router.reload();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Active sessions" />
            <div className="p-4 pb-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Active sessions
                        </h1>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Signed-in users with a session refreshed within the
                            last {session_lifetime_minutes} minutes
                            (configurable session lifetime). Browser and OS are
                            inferred from the User-Agent; installed app vs
                            browser tab uses display-mode when the client
                            reports it.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Times shown in {timezone}.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleRefresh}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden />
                        Refresh
                    </Button>
                </div>

                {sessions_unavailable && sessions_unavailable_reason && (
                    <Alert className="mt-8 max-w-3xl border-amber-500/40 bg-amber-500/5">
                        <AlertTitle className="text-amber-950 dark:text-amber-100">
                            Sessions not available
                        </AlertTitle>
                        <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
                            {sessions_unavailable_reason}
                        </AlertDescription>
                    </Alert>
                )}

                {!sessions_unavailable && (
                    <>
                        <div className="mt-8 grid gap-4 lg:grid-cols-3">
                            <RollupList
                                title="Browsers"
                                data={rollup.by_browser}
                            />
                            <RollupList
                                title="Operating systems (from UA)"
                                data={rollup.by_os}
                            />
                            <RollupList
                                title="Display mode"
                                data={Object.fromEntries(
                                    Object.entries(rollup.by_display_mode).map(
                                        ([k, v]) => [
                                            displayModeLabel(
                                                k === 'unknown' ? null : k,
                                            ),
                                            v,
                                        ],
                                    ),
                                )}
                            />
                        </div>

                        <div className="mt-6 text-sm text-muted-foreground">
                            Showing{' '}
                            <span className="font-medium text-foreground">
                                {total}
                            </span>{' '}
                            active session
                            {total === 1 ? '' : 's'}.
                        </div>

                        <div className="mt-4 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Browser</TableHead>
                                        <TableHead>OS</TableHead>
                                        <TableHead>Platform</TableHead>
                                        <TableHead>App</TableHead>
                                        <TableHead>IP</TableHead>
                                        <TableHead>Last activity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={7}
                                                className="text-muted-foreground"
                                            >
                                                No active sessions in this
                                                window.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((r) => (
                                            <TableRow key={r.session_id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span>
                                                            {r.user_name}
                                                        </span>
                                                        {r.is_current && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                You
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-normal text-muted-foreground">
                                                        {r.user_email}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {r.browser}
                                                </TableCell>
                                                <TableCell>{r.os}</TableCell>
                                                <TableCell
                                                    className="max-w-[10rem] truncate"
                                                    title={r.platform}
                                                >
                                                    {r.platform}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <span>
                                                            {displayModeLabel(
                                                                r.display_mode,
                                                            )}
                                                        </span>
                                                        {r.is_installed_web_app && (
                                                            <Badge
                                                                variant="outline"
                                                                className="w-fit text-xs"
                                                            >
                                                                Installed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {r.ip_address ?? '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        title={
                                                            r.last_activity_at
                                                        }
                                                    >
                                                        {r.last_activity_human}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
