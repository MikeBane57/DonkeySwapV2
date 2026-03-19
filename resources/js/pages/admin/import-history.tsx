import { Head, Link, router } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { getCsrfToken } from '@/lib/csrf';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Import History', href: '/app/admin/import-history' },
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
};

type SelectedRun = {
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
    missing_from_board: { shift_date: string; time_code: string; desk_code: string; start_time_utc: string; action: string }[];
    extra_on_board: { id: number; position_name: string; start_time_utc: string; end_time_utc: string }[];
};

type MasterDiffUser = {
    user_id: number;
    name: string;
    employee_id: string;
    to_add: number;
    to_remove: number;
    to_add_detail: { shift_date: string; time_code: string; desk_code: string; start_time_utc: string }[];
    to_remove_detail: { id: number; position_name: string; start_time_utc: string; has_active_post: boolean }[];
    date_range: [string, string];
};

type MasterApplyResult = {
    user_id: number;
    name: string;
    employee_id: string;
    created: number;
    updated: number;
    removed: number;
    notified: boolean;
    error?: string;
};

type ReconciliationItemResponse = {
    type: string;
    user_action: string | null;
    reason: string | null;
    snapshot: Record<string, unknown> | null;
};

type ReconciliationResponse = {
    id: number;
    user_name: string | null;
    user_employee_id: string | null;
    status: string;
    completed_at: string | null;
    items: ReconciliationItemResponse[];
};

type ReconciliationBatch = {
    id: number;
    created_at: string;
    reconciliations: ReconciliationResponse[];
};

type LastBulkCompare = {
    file_last_modified_ms: number;
    run_at_iso: string;
    users: MasterDiffUser[];
    unmatched_employees: { employee_id: string; name: string }[];
};

type LatestMasterCsvMeta = {
    uploaded_at_iso: string;
    uploaded_by_type: string;
    uploaded_by_id: number;
    employee_count: number;
};

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return iso.slice(0, 10);
    }
}

function timeAgo(ms: number): string {
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} day${day !== 1 ? 's' : ''} ago`;
    const mo = Math.floor(day / 30);
    return `${mo} month${mo !== 1 ? 's' : ''} ago`;
}

export default function ImportHistory({
    runs = [],
    selectedRun = null,
    audit = null,
    reconciliationBatches = [],
    lastBulkCompare: initialLastBulkCompare = null,
    latestMasterCsvMeta = null,
}: {
    runs: Run[];
    selectedRun: SelectedRun | null;
    audit: Audit | null;
    reconciliationBatches?: ReconciliationBatch[];
    lastBulkCompare?: LastBulkCompare | null;
    latestMasterCsvMeta?: LatestMasterCsvMeta | null;
}) {
    const [search, setSearch] = useState('');
    const [masterFile, setMasterFile] = useState<File | null>(null);
    const [masterFileLastModified, setMasterFileLastModified] = useState<number | null>(null);
    const [masterCompareLoading, setMasterCompareLoading] = useState(false);
    const [masterApplyLoading, setMasterApplyLoading] = useState(false);
    const [masterDiff, setMasterDiff] = useState<MasterDiffUser[] | null>(initialLastBulkCompare?.users ?? null);
    const [masterError, setMasterError] = useState<string | null>(null);
    const [masterApplyResult, setMasterApplyResult] = useState<MasterApplyResult[] | null>(null);
    const [masterMessageUsers, setMasterMessageUsers] = useState(true);
    const [masterUnmatched, setMasterUnmatched] = useState<{ employee_id: string; name: string }[]>(initialLastBulkCompare?.unmatched_employees ?? []);
    const [lastBulkCompare, setLastBulkCompare] = useState<LastBulkCompare | null>(initialLastBulkCompare ?? null);
    const [masterReportGeneratedAt, setMasterReportGeneratedAt] = useState<string | null>(null);
    const [unmatchedOpen, setUnmatchedOpen] = useState(false);
    const [showAllRuns, setShowAllRuns] = useState(false);
    const [auditSectionOpen, setAuditSectionOpen] = useState(false);

    const filteredRuns = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return runs;
        return runs.filter(
            (run) =>
                (run.target_user_name ?? '').toLowerCase().includes(q) ||
                (run.target_user_employee_id ?? '').toLowerCase().includes(q) ||
                (run.created_by_name ?? '').toLowerCase().includes(q)
        );
    }, [runs, search]);

    const INITIAL_RUNS_SHOWN = 5;
    const displayRuns = showAllRuns ? filteredRuns : filteredRuns.slice(0, INITIAL_RUNS_SHOWN);
    const hasMoreRuns = filteredRuns.length > INITIAL_RUNS_SHOWN;

    const onMasterCompare = useCallback(async () => {
        if (!masterFile) return;
        if (lastBulkCompare && masterFile.lastModified < lastBulkCompare.file_last_modified_ms) {
            if (!window.confirm('This file is older than the file used in your last compare. Use it anyway?')) {
                return;
            }
        }
        setMasterError(null);
        setMasterApplyResult(null);
        setMasterCompareLoading(true);
        try {
            const form = new FormData();
            form.append('file', masterFile);
            form.append('file_last_modified', String(masterFile.lastModified));
            const res = await fetch('/app/admin/schedule-import/master-compare', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMasterError(data.message || 'Request failed');
                setMasterDiff(null);
                return;
            }
            setMasterDiff(data.users ?? []);
            setMasterUnmatched(data.unmatched_employees ?? []);
            setMasterReportGeneratedAt(data.report_generated_at ?? null);
            if (data.last_bulk_compare) {
                setLastBulkCompare(data.last_bulk_compare);
            }
        } finally {
            setMasterCompareLoading(false);
        }
    }, [masterFile, lastBulkCompare]);

    const onMasterApply = useCallback(async () => {
        if (!masterFile) return;
        setMasterError(null);
        setMasterApplyLoading(true);
        try {
            const form = new FormData();
            form.append('file', masterFile);
            form.append('message_users', masterMessageUsers ? '1' : '0');
            const res = await fetch('/app/admin/schedule-import/master-apply', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getCsrfToken() },
                credentials: 'include',
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMasterError(data.message || 'Request failed');
                return;
            }
            setMasterApplyResult(data.results ?? []);
            setMasterDiff(null);
        } finally {
            setMasterApplyLoading(false);
        }
    }, [masterFile, masterMessageUsers]);

    const onSelectRunForCompare = (runId: number) => {
        router.get('/app/admin/import-history', { run_id: runId }, { preserveState: true });
    };

    const hasIssues = (run: Run) => run.conflict_count > 0 || run.skipped_count > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Import History" />
            <div className="p-4 space-y-6">
                <h1 className="text-2xl font-semibold">Import History</h1>
                <p className="text-muted-foreground text-sm">
                    Schedule import runs (user and admin). Search and filter, then click a run to see details or compare to current board.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-[200px]">
                        <Label htmlFor="search-runs" className="sr-only">
                            Search runs
                        </Label>
                        <Input
                            id="search-runs"
                            type="search"
                            placeholder="Search by user or employee ID…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2 text-left">Time</th>
                                <th className="p-2 text-left">By</th>
                                <th className="p-2 text-left">Target user</th>
                                <th className="p-2 text-left">Mode</th>
                                <th className="p-2 text-right">Rows</th>
                                <th className="p-2 text-right">Created</th>
                                <th className="p-2 text-right">Updated</th>
                                <th className="p-2 text-right">Skipped</th>
                                <th className="p-2 text-right">Conflict</th>
                                <th className="p-2 text-right">Missing</th>
                                <th className="p-2 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRuns.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="p-4 text-center text-muted-foreground">
                                        {runs.length === 0 ? 'No import runs yet.' : 'No runs match your search.'}
                                    </td>
                                </tr>
                            ) : (
                                displayRuns.map((run) => (
                                    <tr
                                        key={run.id}
                                        className={`border-b border-border/70 ${
                                            hasIssues(run) ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                                        }`}
                                    >
                                        <td className="p-2 whitespace-nowrap">
                                            {new Date(run.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-2">{run.created_by_name ?? '—'}</td>
                                        <td className="p-2">
                                            {run.target_user_name ?? '—'}
                                            {run.target_user_employee_id && (
                                                <span className="text-muted-foreground ml-1">
                                                    ({run.target_user_employee_id})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2">{run.mode === 'admin_bulk_push' || run.mode === 'master' ? 'Admin bulk push' : run.mode}</td>
                                        <td className="p-2 text-right">{run.row_count}</td>
                                        <td className="p-2 text-right">{run.created_count}</td>
                                        <td className="p-2 text-right">{run.updated_count}</td>
                                        <td className="p-2 text-right">
                                            {run.skipped_count > 0 ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                    {run.skipped_count}
                                                </span>
                                            ) : (
                                                run.skipped_count
                                            )}
                                        </td>
                                        <td className="p-2 text-right">
                                            {run.conflict_count > 0 ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                    {run.conflict_count}
                                                </span>
                                            ) : (
                                                run.conflict_count
                                            )}
                                        </td>
                                        <td className="p-2 text-right">{run.missing_count}</td>
                                        <td className="p-2 flex flex-wrap gap-1">
                                            <Link
                                                href={`/app/admin/import-history/${run.id}`}
                                                className="text-primary hover:underline"
                                            >
                                                View
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => onSelectRunForCompare(run.id)}
                                                className="text-primary hover:underline"
                                            >
                                                Compare
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {hasMoreRuns && (
                    <div className="flex justify-center py-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllRuns((v) => !v)}
                        >
                            {showAllRuns
                                ? `Show less (${filteredRuns.length} runs)`
                                : `Show more (${filteredRuns.length - INITIAL_RUNS_SHOWN} more)`}
                        </Button>
                    </div>
                )}

                <Collapsible open={auditSectionOpen} onOpenChange={setAuditSectionOpen}>
                    <section className="space-y-4 rounded-lg border border-border p-4">
                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 text-left font-medium hover:underline"
                            >
                                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${auditSectionOpen ? 'rotate-90' : ''}`} />
                                Compare run to current board
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                        Select a run to see what was in the import vs what is on the user&apos;s board now (missing from board, extra on board).
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="run-select" className="text-sm font-medium">
                            Select run:
                        </label>
                        <select
                            id="run-select"
                            className="rounded border border-input bg-background px-3 py-1.5 text-sm"
                            value={selectedRun?.id ?? ''}
                            onChange={(e) => onSelectRunForCompare(Number(e.target.value))}
                        >
                            <option value="">—</option>
                            {runs.map((r) => (
                                <option key={r.id} value={r.id}>
                                    #{r.id} {formatDate(r.created_at)} — {r.target_user_name ?? '?'} (
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
                        <div className="space-y-4 pt-2">
                            {audit.date_range ? (
                                <p className="text-sm text-muted-foreground">
                                    Date range: {audit.date_range[0]} to {audit.date_range[1]}
                                </p>
                            ) : null}
                            <p className="text-sm">
                                In import (create/update): {audit.import_count} · On board now: {audit.current_count}
                            </p>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                                        Missing from board ({audit.missing_from_board.length})
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-1">
                                        Were in the import but no matching shift on board (may have been deleted).
                                    </p>
                                    <div className="overflow-x-auto rounded border border-border max-h-60 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/50">
                                                    <th className="p-2 text-left">Date</th>
                                                    <th className="p-2 text-left">Time</th>
                                                    <th className="p-2 text-left">Desk</th>
                                                    <th className="p-2 text-left">Start UTC</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {audit.missing_from_board.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="p-2 text-muted-foreground">
                                                            None
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    audit.missing_from_board.map((row, i) => (
                                                        <tr key={i} className="border-b border-border/70">
                                                            <td className="p-2">{row.shift_date}</td>
                                                            <td className="p-2">{row.time_code}</td>
                                                            <td className="p-2">{row.desk_code}</td>
                                                            <td className="p-2">{row.start_time_utc?.slice(0, 19)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-medium text-blue-700 dark:text-blue-400 mb-2">
                                        Extra on board ({audit.extra_on_board.length})
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-1">
                                        Shifts on board in this range that were not in the import.
                                    </p>
                                    <div className="overflow-x-auto rounded border border-border max-h-60 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/50">
                                                    <th className="p-2 text-left">Position</th>
                                                    <th className="p-2 text-left">Start UTC</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {audit.extra_on_board.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={2} className="p-2 text-muted-foreground">
                                                            None
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    audit.extra_on_board.map((row) => (
                                                        <tr key={row.id} className="border-b border-border/70">
                                                            <td className="p-2">{row.position_name}</td>
                                                            <td className="p-2">{row.start_time_utc?.slice(0, 19)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                        </CollapsibleContent>
                    </section>
                </Collapsible>

                <section className="space-y-4 rounded-lg border border-border p-4">
                    <h2 className="font-medium">Bulk CSV</h2>
                    <p className="text-sm text-muted-foreground">
                        Use extended schedule from Workzone — all workers. Upload the CSV, compare to see which users have differences (shifts to add or remove), then push and remove; optionally message affected users.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-[200px]">
                            <Label htmlFor="master-csv" className="sr-only">Bulk CSV</Label>
                            <Input
                                id="master-csv"
                                type="file"
                                accept=".csv,text/csv,text/plain"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    setMasterFile(f ?? null);
                                    setMasterFileLastModified(f?.lastModified ?? null);
                                    setMasterReportGeneratedAt(null);
                                    setMasterDiff(null);
                                    setMasterUnmatched([]);
                                    setMasterError(null);
                                    setMasterApplyResult(null);
                                }}
                                className="h-9"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!masterFile || masterCompareLoading}
                            onClick={onMasterCompare}
                        >
                            {masterCompareLoading ? 'Comparing…' : 'Compare'}
                        </Button>
                        {masterDiff && masterDiff.length > 0 && (
                            <>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={masterMessageUsers}
                                        onChange={(e) => setMasterMessageUsers(e.target.checked)}
                                    />
                                    Message users about changes
                                </label>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={masterApplyLoading}
                                    onClick={() => {
                                    const add = masterDiff.reduce((s, u) => s + u.to_add, 0);
                                    const remove = masterDiff.reduce((s, u) => s + u.to_remove, 0);
                                    if (window.confirm(`Push ${add} shift(s) and remove ${remove} shift(s) for ${masterDiff.length} user(s)?${masterMessageUsers ? ' They will receive a notification.' : ''}`)) {
                                        onMasterApply();
                                    }
                                }}
                                >
                                    {masterApplyLoading ? 'Applying…' : 'Push & remove'}
                                </Button>
                            </>
                        )}
                    </div>
                    {lastBulkCompare && (
                        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
                            <p className="font-medium text-foreground">Latest compare run</p>
                            {latestMasterCsvMeta && (
                                <p className="text-muted-foreground text-xs">
                                    Stored master CSV ({latestMasterCsvMeta.employee_count} employees), uploaded {latestMasterCsvMeta.uploaded_by_type === 'api' ? 'by user' : 'by admin'} at {new Date(latestMasterCsvMeta.uploaded_at_iso).toLocaleString()}. New uploads with 10+ employees update this and refresh the compare.
                                </p>
                            )}
                            <p className="text-muted-foreground">
                                File last modified: {new Date(lastBulkCompare.file_last_modified_ms).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                            <p className="text-muted-foreground">
                                Time since that file: {timeAgo(lastBulkCompare.file_last_modified_ms)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                                Run at {new Date(lastBulkCompare.run_at_iso).toLocaleString()}. Users with diffs: {lastBulkCompare.users?.length ?? 0}; unmatched: {lastBulkCompare.unmatched_employees?.length ?? 0}.
                            </p>
                        </div>
                    )}
                    {masterFileLastModified != null && lastBulkCompare && masterFileLastModified < lastBulkCompare.file_last_modified_ms && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                            This file is older than the file used in your last compare. Consider using a newer report.
                        </div>
                    )}
                    {masterFileLastModified != null && (
                        <p className="text-sm text-muted-foreground">
                            Selected file last modified: {new Date(masterFileLastModified).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    )}
                    {masterReportGeneratedAt != null && (
                        <p className="text-sm text-muted-foreground">
                            Report generated: {new Date(masterReportGeneratedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    )}
                    {masterError && (
                        <p className="text-sm text-destructive">{masterError}</p>
                    )}
                    {masterDiff && masterDiff.length === 0 && masterUnmatched.length === 0 && !masterError && (
                        <p className="text-sm text-muted-foreground">No differences found. All users match the CSV; no unmatched employee IDs.</p>
                    )}
                    {masterUnmatched.length > 0 && (
                        <Collapsible open={unmatchedOpen} onOpenChange={setUnmatchedOpen}>
                            <div className="space-y-2">
                                <CollapsibleTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                                    >
                                        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${unmatchedOpen ? 'rotate-90' : ''}`} />
                                        Employee IDs without an active user ({masterUnmatched.length})
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <p className="text-xs text-muted-foreground">
                                        These IDs appear in the CSV but do not have a user in the app. They were not included in the compare or push.
                                    </p>
                                    <div className="overflow-x-auto rounded-lg border border-border">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/50">
                                                    <th className="p-2 text-left">Name</th>
                                                    <th className="p-2 text-left">Employee ID</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {masterUnmatched.map((u) => (
                                                    <tr key={u.employee_id} className="border-b border-border/70">
                                                        <td className="p-2">{u.name || '—'}</td>
                                                        <td className="p-2 font-mono">{u.employee_id}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>
                    )}
                    {masterDiff && masterDiff.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-2 text-left">User</th>
                                        <th className="p-2 text-left">Employee ID</th>
                                        <th className="p-2 text-right">To add</th>
                                        <th className="p-2 text-right">To remove</th>
                                        <th className="p-2 text-left">Date range</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterDiff.map((u) => (
                                        <tr key={u.user_id} className="border-b border-border/70">
                                            <td className="p-2">{u.name}</td>
                                            <td className="p-2">{u.employee_id}</td>
                                            <td className="p-2 text-right">{u.to_add}</td>
                                            <td className="p-2 text-right">{u.to_remove}</td>
                                            <td className="p-2 text-muted-foreground">
                                                {u.date_range[0]} – {u.date_range[1]}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {masterApplyResult && masterApplyResult.length > 0 && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/40">
                            <p className="font-medium text-green-800 dark:text-green-200">Bulk schedule applied</p>
                            <ul className="mt-1 list-inside text-sm text-green-700 dark:text-green-300">
                                {masterApplyResult.map((r) => (
                                    <li key={r.user_id}>
                                        {r.name}: {r.created} added, {r.updated} updated, {r.removed} removed
                                        {r.notified && ' (notified)'}
                                        {r.error && ` — ${r.error}`}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                {reconciliationBatches.length > 0 && (
                    <section className="space-y-4 rounded-lg border border-border p-4">
                        <h2 className="font-medium">Reconciliation responses</h2>
                        <p className="text-sm text-muted-foreground">
                            User responses from bulk schedule reconcile: reject/keep reasons.
                        </p>
                        <div className="space-y-4">
                            {reconciliationBatches.map((batch) => (
                                <div key={batch.id} className="rounded border border-border p-3">
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Batch #{batch.id} · {formatDate(batch.created_at)}
                                    </p>
                                    {batch.reconciliations.filter((r) => r.items.length > 0).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No responses with reasons yet.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {batch.reconciliations.map((r) => {
                                                const withReasons = r.items.filter((i) => i.user_action && i.reason);
                                                if (withReasons.length === 0) return null;
                                                return (
                                                    <li key={r.id} className="text-sm">
                                                        <span className="font-medium">{r.user_name ?? '—'}</span>
                                                        {r.user_employee_id && (
                                                            <span className="text-muted-foreground ml-1">({r.user_employee_id})</span>
                                                        )}
                                                        <ul className="ml-4 mt-1 list-disc text-muted-foreground">
                                                            {withReasons.map((i, idx) => (
                                                                <li key={idx}>
                                                                    {i.type} → {i.user_action}: {i.reason}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </AppLayout>
    );
}
