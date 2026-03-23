import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Import Audit', href: '/app/admin/import-audit' },
];

type Run = {
    id: number;
    created_at: string;
    target_user_name: string | null;
    target_user_employee_id: string | null;
    mode: string;
};

type Audit = {
    date_range: [string, string] | null;
    import_count: number;
    current_count: number;
    missing_from_board: {
        shift_date: string;
        time_code: string;
        desk_code: string;
        start_time_utc: string;
        action: string;
    }[];
    extra_on_board: {
        id: number;
        position_name: string;
        start_time_utc: string;
        end_time_utc: string;
    }[];
};

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return iso.slice(0, 10);
    }
}

export default function ImportAudit({
    runs = [],
    selectedRun = null,
    audit = null,
}: {
    runs: Run[];
    selectedRun: Run | null;
    audit: Audit | null;
}) {
    const onSelectRun = (runId: number) => {
        router.get(
            '/app/admin/import-audit',
            { run_id: runId },
            { preserveState: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Import Audit" />
            <div className="space-y-4 p-4">
                <h1 className="text-2xl font-semibold">Import Audit</h1>
                <p className="text-sm text-muted-foreground">
                    Compare an import run to current shifts for that user.
                    Select a run to see what was in the import vs what is on the
                    board now.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="run-select" className="text-sm font-medium">
                        Select run:
                    </label>
                    <select
                        id="run-select"
                        className="rounded border border-input bg-background px-3 py-1.5 text-sm"
                        value={selectedRun?.id ?? ''}
                        onChange={(e) => onSelectRun(Number(e.target.value))}
                    >
                        <option value="">—</option>
                        {runs.map((r) => (
                            <option key={r.id} value={r.id}>
                                #{r.id} {formatDate(r.created_at)} —{' '}
                                {r.target_user_name ?? '?'} (
                                {r.target_user_employee_id ?? ''})
                            </option>
                        ))}
                    </select>
                    {selectedRun && (
                        <Link
                            href={`/app/admin/import-history/${selectedRun.id}`}
                            className="text-sm text-primary hover:underline"
                        >
                            View run details
                        </Link>
                    )}
                </div>

                {audit && (
                    <div className="space-y-4 rounded-lg border border-border p-4">
                        <h2 className="font-medium">Comparison</h2>
                        {audit.date_range ? (
                            <p className="text-sm text-muted-foreground">
                                Date range: {audit.date_range[0]} to{' '}
                                {audit.date_range[1]}
                            </p>
                        ) : null}
                        <p className="text-sm">
                            In import (create/update): {audit.import_count} · On
                            board now: {audit.current_count}
                        </p>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <h3 className="mb-2 font-medium text-amber-700 dark:text-amber-400">
                                    Missing from board (
                                    {audit.missing_from_board.length})
                                </h3>
                                <p className="mb-1 text-xs text-muted-foreground">
                                    Were in the import but no matching shift on
                                    board (may have been deleted).
                                </p>
                                <div className="max-h-60 overflow-x-auto overflow-y-auto rounded border border-border">
                                    <table className="w-full min-w-max text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="p-2 text-left">
                                                    Date
                                                </th>
                                                <th className="p-2 text-left">
                                                    Time
                                                </th>
                                                <th className="p-2 text-left">
                                                    Desk
                                                </th>
                                                <th className="p-2 text-left">
                                                    Start UTC
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {audit.missing_from_board.length ===
                                            0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={4}
                                                        className="p-2 text-muted-foreground"
                                                    >
                                                        None
                                                    </td>
                                                </tr>
                                            ) : (
                                                audit.missing_from_board.map(
                                                    (row, i) => (
                                                        <tr
                                                            key={i}
                                                            className="border-b border-border/70"
                                                        >
                                                            <td className="p-2">
                                                                {row.shift_date}
                                                            </td>
                                                            <td className="p-2">
                                                                {row.time_code}
                                                            </td>
                                                            <td className="p-2">
                                                                {row.desk_code}
                                                            </td>
                                                            <td className="p-2">
                                                                {row.start_time_utc?.slice(
                                                                    0,
                                                                    19,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <h3 className="mb-2 font-medium text-blue-700 dark:text-blue-400">
                                    Extra on board (
                                    {audit.extra_on_board.length})
                                </h3>
                                <p className="mb-1 text-xs text-muted-foreground">
                                    Shifts on board in this range that were not
                                    in the import.
                                </p>
                                <div className="max-h-60 overflow-x-auto overflow-y-auto rounded border border-border">
                                    <table className="w-full min-w-max text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="p-2 text-left">
                                                    Position
                                                </th>
                                                <th className="p-2 text-left">
                                                    Start UTC
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {audit.extra_on_board.length ===
                                            0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={2}
                                                        className="p-2 text-muted-foreground"
                                                    >
                                                        None
                                                    </td>
                                                </tr>
                                            ) : (
                                                audit.extra_on_board.map(
                                                    (row) => (
                                                        <tr
                                                            key={row.id}
                                                            className="border-b border-border/70"
                                                        >
                                                            <td className="p-2">
                                                                {
                                                                    row.position_name
                                                                }
                                                            </td>
                                                            <td className="p-2">
                                                                {row.start_time_utc?.slice(
                                                                    0,
                                                                    19,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
