import { Head } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { getCsrfToken } from '@/lib/csrf';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Bulk Schedule Import', href: '/app/admin/import-bulk' },
];

type MatchedUser = {
    employee_id: string;
    user_id: number;
    name: string;
    row_count: number;
};

type BulkResult = {
    employee_id: string;
    user_id: number | null;
    run_id: number | null;
    error?: string;
    created?: number;
    updated?: number;
    skipped?: number;
    conflict?: number;
    missing_shift_ids?: number[];
};

export default function ImportBulk() {
    const [file, setFile] = useState<File | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [applyLoading, setApplyLoading] = useState(false);
    const [matched, setMatched] = useState<MatchedUser[]>([]);
    const [unmatched, setUnmatched] = useState<string[]>([]);
    const [results, setResults] = useState<BulkResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pastCount, setPastCount] = useState(0);

    const sendCsv = useCallback(
        async (endpoint: 'bulk-preview' | 'bulk-apply') => {
            if (!file) return;
            setError(null);
            const form = new FormData();
            form.append('file', file);
            form.append('file_last_modified', String(file.lastModified));
            const res = await fetch(`/app/admin/schedule-import/${endpoint}`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(
                    res.status === 413
                        ? data.message ||
                              'File too large. Maximum size is 50 MB.'
                        : data.message || 'Request failed',
                );
                setMatched([]);
                setUnmatched([]);
                setResults(null);
                setPastCount(0);
                return data;
            }
            if (endpoint === 'bulk-preview') {
                setMatched(data.matched ?? []);
                setUnmatched(data.unmatched ?? []);
                setPastCount(data.past_count ?? 0);
                setResults(null);
            } else {
                setResults(data.results ?? []);
                setPastCount(data.past_count ?? 0);
            }
            return data;
        },
        [file],
    );

    const onPreview = async () => {
        if (!file) return;
        setPreviewLoading(true);
        try {
            await sendCsv('bulk-preview');
        } finally {
            setPreviewLoading(false);
        }
    };

    const onApply = async () => {
        if (!file) return;
        setApplyLoading(true);
        try {
            await sendCsv('bulk-apply');
        } finally {
            setApplyLoading(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bulk Schedule Import" />
            <div className="space-y-6 p-4">
                <h1 className="text-2xl font-semibold">Bulk Schedule Import</h1>
                <p className="text-sm text-muted-foreground">
                    Upload an ARIS expanded schedule file (CSV). Rows are
                    grouped by Employee ID; each user with a matching Employee
                    ID in the system will get their shifts imported. Shifts in
                    the past are not added. One import run is created per user.
                </p>

                <div className="space-y-2">
                    <Label htmlFor="csv-file">CSV file (max 50 MB)</Label>
                    <Input
                        id="csv-file"
                        type="file"
                        accept=".csv,text/csv,text/plain"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            setFile(f ?? null);
                            setMatched([]);
                            setUnmatched([]);
                            setResults(null);
                            setPastCount(0);
                        }}
                    />
                </div>

                {error && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        disabled={!file || previewLoading}
                        onClick={onPreview}
                    >
                        {previewLoading ? 'Loading…' : 'Preview'}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={!file || matched.length === 0 || applyLoading}
                        onClick={onApply}
                    >
                        {applyLoading
                            ? 'Applying…'
                            : 'Apply import for all matched users'}
                    </Button>
                </div>

                {pastCount > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                        {pastCount} shift{pastCount !== 1 ? 's' : ''} in the
                        past were not added.
                    </p>
                )}

                {unmatched.length > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                        Employee IDs in CSV with no matching user:{' '}
                        {unmatched.join(', ')}
                    </p>
                )}

                {matched.length > 0 && (
                    <>
                        <h2 className="font-medium">
                            Matched users ({matched.length})
                        </h2>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full min-w-max text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-2 text-left">
                                            Employee ID
                                        </th>
                                        <th className="p-2 text-left">Name</th>
                                        <th className="p-2 text-right">
                                            Shifts
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matched.map((m) => (
                                        <tr
                                            key={m.user_id}
                                            className="border-b border-border/70"
                                        >
                                            <td className="p-2">
                                                {m.employee_id}
                                            </td>
                                            <td className="p-2">{m.name}</td>
                                            <td className="p-2 text-right">
                                                {m.row_count}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {results && results.length > 0 && (
                    <>
                        <h2 className="font-medium">Last apply result</h2>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full min-w-max text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-2 text-left">
                                            Employee ID
                                        </th>
                                        <th className="p-2 text-left">
                                            Run ID
                                        </th>
                                        <th className="p-2 text-right">
                                            Created
                                        </th>
                                        <th className="p-2 text-right">
                                            Updated
                                        </th>
                                        <th className="p-2 text-right">
                                            Skipped
                                        </th>
                                        <th className="p-2 text-right">
                                            Conflict
                                        </th>
                                        <th className="p-2 text-left">Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, i) => (
                                        <tr
                                            key={i}
                                            className="border-b border-border/70"
                                        >
                                            <td className="p-2">
                                                {r.employee_id}
                                            </td>
                                            <td className="p-2">
                                                {r.run_id != null ? (
                                                    <a
                                                        href={`/app/admin/import-history/${r.run_id}`}
                                                        className="text-primary hover:underline"
                                                    >
                                                        {r.run_id}
                                                    </a>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="p-2 text-right">
                                                {r.created ?? '—'}
                                            </td>
                                            <td className="p-2 text-right">
                                                {r.updated ?? '—'}
                                            </td>
                                            <td className="p-2 text-right">
                                                {r.skipped ?? '—'}
                                            </td>
                                            <td className="p-2 text-right">
                                                {r.conflict ?? '—'}
                                            </td>
                                            <td className="p-2 text-destructive">
                                                {r.error ?? '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
