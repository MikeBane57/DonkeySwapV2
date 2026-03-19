import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Import History', href: '/app/admin/import-history' },
    { title: 'Run detail', href: '#' },
];

type Run = {
    id: number;
    created_at: string;
    created_by_name: string | null;
    target_user_name: string | null;
    target_user_employee_id: string | null;
    mode: string;
    status: string;
    row_count: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    conflict_count: number;
    missing_count: number;
    meta: Record<string, unknown> | null;
};

type Item = {
    id: number;
    shift_date: string | null;
    time_code: string | null;
    desk_code: string | null;
    start_time_utc: string | null;
    end_time_utc: string | null;
    action: string;
    reason: string | null;
    matched_shift_id: number | null;
    warnings: Record<string, unknown> | null;
};

export default function ImportHistoryShow({ run, items = [] }: { run: Run; items: Item[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Import run #${run.id}`} />
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Link href="/app/admin/import-history" className="text-primary hover:underline text-sm">
                        ← Back to Import History
                    </Link>
                </div>
                <h1 className="text-2xl font-semibold">Import run #{run.id}</h1>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{new Date(run.created_at).toLocaleString()}</dd>
                    <dt className="text-muted-foreground">By</dt>
                    <dd>{run.created_by_name ?? '—'}</dd>
                    <dt className="text-muted-foreground">Target user</dt>
                    <dd>
                        {run.target_user_name ?? '—'}
                        {run.target_user_employee_id && ` (${run.target_user_employee_id})`}
                    </dd>
                    <dt className="text-muted-foreground">Mode</dt>
                    <dd>{run.mode}</dd>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{run.status}</dd>
                    <dt className="text-muted-foreground">Rows / Created / Updated / Skipped / Conflict / Missing</dt>
                    <dd>
                        {run.row_count} / {run.created_count} / {run.updated_count} / {run.skipped_count} / {run.conflict_count} / {run.missing_count}
                    </dd>
                </dl>
                {run.meta?.missing_shift_ids && Array.isArray(run.meta.missing_shift_ids) && (
                    <p className="text-sm text-muted-foreground">
                        Missing shift IDs (on board but not in import): {(run.meta.missing_shift_ids as number[]).join(', ')}
                    </p>
                )}
                <h2 className="font-medium">Run items (first 500)</h2>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2 text-left">Date</th>
                                <th className="p-2 text-left">Time</th>
                                <th className="p-2 text-left">Desk</th>
                                <th className="p-2 text-left">Start UTC</th>
                                <th className="p-2 text-left">Action</th>
                                <th className="p-2 text-left">Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                                        No items.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id} className="border-b border-border/70">
                                        <td className="p-2">{item.shift_date ?? '—'}</td>
                                        <td className="p-2">{item.time_code ?? '—'}</td>
                                        <td className="p-2">{item.desk_code ?? '—'}</td>
                                        <td className="p-2">{item.start_time_utc?.slice(0, 19) ?? '—'}</td>
                                        <td className="p-2">{item.action}</td>
                                        <td className="p-2">{item.reason ?? '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
