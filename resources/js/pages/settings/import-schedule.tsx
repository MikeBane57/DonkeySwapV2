import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { getCsrfToken } from '@/lib/csrf';
import type { BreadcrumbItem } from '@/types';

const MAX_MB = 50;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/app/settings/profile' },
    { title: 'Import schedule', href: '/app/settings/import-schedule' },
];

type DeskTypeOption = { code: string; label: string; is_regulatory: boolean };
type WorkgroupDeskTypes = { workgroup_id: number; workgroup_name: string; desk_types: DeskTypeOption[] };

type PreviewRow = {
    shift_date: string;
    time_code: string;
    desk_code: string;
    start_utc: string;
    end_utc: string;
    workgroup_id: number;
    desk_type: string;
    position_name: string;
    regulatory: boolean;
    unmapped_desk?: boolean;
    in_past?: boolean;
};

type MissingShift = {
    id: number;
    position_name: string;
    start_time_utc: string;
    end_time_utc: string;
    has_active_post: boolean;
};

type ReconcileModifyChange = { old: unknown; new: unknown };
type ReconcileModifyItem = {
    preview_row: PreviewRow;
    shift_id: number;
    position_name: string;
    start_time_utc: string;
    changes: Record<string, ReconcileModifyChange>;
};
type ReconcileData = {
    to_add: PreviewRow[];
    to_remove: MissingShift[];
    to_modify: ReconcileModifyItem[];
};

type ApplyResult = {
    message: string;
    run_id: number | null;
    created: number;
    updated: number;
    skipped: number;
    conflict: number;
    past_count?: number;
    missing_shift_ids: number[];
    missing_shifts?: MissingShift[];
};

type HistoryRun = {
    id: number;
    created_at: string;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    conflict_count: number;
    missing_count: number;
};

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return iso.slice(0, 10);
    }
}

export default function ImportSchedule() {
    const { auth } = usePage().props as { auth: { user: { employee_id?: string | null } } };
    const [file, setFile] = useState<File | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [applyLoading, setApplyLoading] = useState(false);
    const [preview, setPreview] = useState<PreviewRow[] | null>(null);
    const [unmapped, setUnmapped] = useState<string[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
    const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
    const [dismissedMissingIds, setDismissedMissingIds] = useState<Set<number>>(new Set());
    const [moveShift, setMoveShift] = useState<MissingShift | null>(null);
    const [moveDate, setMoveDate] = useState('');
    const [moveTime, setMoveTime] = useState('');
    const [moveSubmitting, setMoveSubmitting] = useState(false);
    const [editPreviewIndex, setEditPreviewIndex] = useState<number | null>(null);
    const [editPreviewDate, setEditPreviewDate] = useState('');
    const [editPreviewTimeCode, setEditPreviewTimeCode] = useState('');
    const [deleteAllMissingLoading, setDeleteAllMissingLoading] = useState(false);
    const [pastCountFromPreview, setPastCountFromPreview] = useState(0);
    const [userDeskTypes, setUserDeskTypes] = useState<WorkgroupDeskTypes[]>([]);
    const [fileLastModified, setFileLastModified] = useState<number | null>(null);
    const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null);
    const [reconcile, setReconcile] = useState<ReconcileData | null>(null);
    const [reconcileReviewed, setReconcileReviewed] = useState(false);

    const fetchHistory = useCallback(() => {
        fetch('/api/schedule-import/history', {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        })
            .then((r) => r.json())
            .then((data) => setHistoryRuns(data.runs ?? []))
            .catch(() => setHistoryRuns([]));
    }, []);

    useEffect(() => {
        if (auth?.user?.employee_id) fetchHistory();
    }, [auth?.user?.employee_id, fetchHistory]);

    const missingShifts = (applyResult?.missing_shifts ?? []).filter((s) => !dismissedMissingIds.has(s.id));

    const sendCsv = useCallback(async (endpoint: 'preview' | 'apply', rowsToApply?: PreviewRow[]) => {
        if (endpoint === 'preview') {
            if (!file) return;
            const form = new FormData();
            form.append('file', file);
            form.append('file_last_modified', String(file.lastModified));
            const res = await fetch('/api/schedule-import/preview', {
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
                const msg = res.status === 413 ? (data.message || 'File too large. Maximum size is 50 MB.') : (data.message || 'Request failed');
                setErrors([msg]);
                setPreview(null);
                setUnmapped([]);
                setApplyResult(null);
                return data;
            }
            setPreview(data.preview ?? []);
            setUnmapped(data.unmapped ?? []);
            setErrors(data.errors ?? []);
            setPastCountFromPreview(data.past_count ?? 0);
            setUserDeskTypes(data.user_desk_types ?? []);
            setReportGeneratedAt(data.report_generated_at ?? null);
            setReconcile(data.reconcile ?? { to_add: [], to_remove: [], to_modify: [] });
            setReconcileReviewed(false);
            setApplyResult(null);
            setDismissedMissingIds(new Set());
            return data;
        }

        // apply
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': getCsrfToken(),
        };
        let body: string;
        if (rowsToApply != null && rowsToApply.length > 0) {
            const toApply = rowsToApply
                .filter((r) => !r.in_past)
                .map((r) => ({
                    shift_date: r.shift_date,
                    time_code: r.time_code,
                    desk_code: r.desk_code,
                    workgroup_id: r.workgroup_id,
                    desk_type: r.desk_type,
                }));
            body = JSON.stringify({ rows_to_apply: toApply });
        } else {
            if (!file) return;
            const form = new FormData();
            form.append('file', file);
            form.append('file_last_modified', String(file.lastModified));
            const res = await fetch('/api/schedule-import/apply', {
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
                setErrors([data.message || 'Request failed']);
                return data;
            }
            setApplyResult({
                message: data.message ?? 'Import applied.',
                run_id: data.run_id ?? null,
                created: data.created ?? 0,
                updated: data.updated ?? 0,
                skipped: data.skipped ?? 0,
                conflict: data.conflict ?? 0,
                past_count: data.past_count,
                missing_shift_ids: data.missing_shift_ids ?? [],
                missing_shifts: data.missing_shifts ?? [],
            });
            setPreview(null);
            setPastCountFromPreview(0);
            setDismissedMissingIds(new Set());
            fetchHistory();
            return data;
        }
        const res = await fetch('/api/schedule-import/apply', {
            method: 'POST',
            headers,
            credentials: 'include',
            body,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setErrors([data.message || 'Request failed']);
            return data;
        }
        setApplyResult({
            message: data.message ?? 'Import applied.',
            run_id: data.run_id ?? null,
            created: data.created ?? 0,
            updated: data.updated ?? 0,
            skipped: data.skipped ?? 0,
            conflict: data.conflict ?? 0,
            missing_shift_ids: data.missing_shift_ids ?? [],
            missing_shifts: data.missing_shifts ?? [],
        });
        setPreview(null);
        setDismissedMissingIds(new Set());
        fetchHistory();
        return data;
    }, [file, fetchHistory]);

    const onPreview = async () => {
        if (!file) return;
        setPreviewLoading(true);
        setErrors([]);
        try {
            await sendCsv('preview');
        } finally {
            setPreviewLoading(false);
        }
    };

    const onApply = async () => {
        setApplyLoading(true);
        try {
            if (preview && preview.length > 0) {
                await sendCsv('apply', preview.filter((r) => !r.in_past));
            } else if (file) {
                await sendCsv('apply');
            }
        } finally {
            setApplyLoading(false);
        }
    };

    const onDeleteMissing = async (id: number) => {
        if (!window.confirm('Remove this shift from your schedule? Any post for this shift will also be removed. This cannot be undone.')) return;
        const res = await fetch(`/api/shifts/${id}`, {
            method: 'DELETE',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        });
        if (res.ok) setDismissedMissingIds((prev) => new Set([...prev, id]));
    };

    const onDeleteAllMissing = async () => {
        if (missingShifts.length === 0) return;
        if (!window.confirm(`Remove all ${missingShifts.length} shift(s) from your schedule? Any posts will also be removed. This cannot be undone.`)) return;
        setDeleteAllMissingLoading(true);
        try {
            for (const s of missingShifts) {
                const res = await fetch(`/api/shifts/${s.id}`, {
                    method: 'DELETE',
                    headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'include',
                });
                if (res.ok) setDismissedMissingIds((prev) => new Set([...prev, s.id]));
            }
        } finally {
            setDeleteAllMissingLoading(false);
        }
    };

    const removePreviewRow = (index: number) => {
        setPreview((prev) => (prev ? prev.filter((_, i) => i !== index) : null));
    };

    const saveEditPreviewRow = () => {
        if (editPreviewIndex == null || !preview) return;
        const row = preview[editPreviewIndex];
        if (!row) return;
        setPreview((prev) => {
            if (!prev) return null;
            const next = [...prev];
            next[editPreviewIndex] = { ...row, shift_date: editPreviewDate, time_code: editPreviewTimeCode };
            return next;
        });
        setEditPreviewIndex(null);
    };

    const onMoveSubmit = async () => {
        if (!moveShift || !moveDate) return;
        setMoveSubmitting(true);
        try {
            const res = await fetch(`/api/shifts/${moveShift.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ start_date: moveDate, start_time: moveTime || undefined }),
            });
            if (res.ok) {
                setDismissedMissingIds((prev) => new Set([...prev, moveShift.id]));
                setMoveShift(null);
                setMoveDate('');
                setMoveTime('');
            }
        } finally {
            setMoveSubmitting(false);
        }
    };

    const noEmployeeId = !auth?.user?.employee_id;
    const hasReconcileChanges = reconcile && (reconcile.to_add.length + reconcile.to_remove.length + reconcile.to_modify.length > 0);
    const canApply = (file != null || (preview != null && preview.length > 0)) && (!hasReconcileChanges || reconcileReviewed);

    const previewCalendarEvents = useMemo(() => {
        if (!preview?.length) return [];
        return preview.map((row, i) => {
            const start = row.start_utc ?? `${row.shift_date}T12:00:00Z`;
            const end = row.end_utc ?? start;
            const title = `${row.time_code} ${row.desk_code}`.trim() || row.position_name || 'Shift';
            return {
                id: `preview-${i}`,
                title: row.in_past ? `(Past) ${title}` : title,
                start,
                end,
                extendedProps: { inPast: row.in_past, index: i },
            };
        });
    }, [preview]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Import schedule" />

            <h1 className="sr-only">Import schedule</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Import schedule from CSV"
                        description="Upload an ARIS expanded schedule file (CSV). Only rows matching your Employee ID are imported. Shifts in the past are not added. Shifts are added or updated; existing shifts with open postings are left unchanged. Shifts on your board that are not in the file are listed for you to reconcile."
                    />

                    {noEmployeeId && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            Set your <strong>Employee ID</strong> in Profile settings so we can match your schedule row in the CSV.
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="csv-file">CSV file (max {MAX_MB} MB)</Label>
                        <Input
                            id="csv-file"
                            type="file"
                            accept=".csv,text/csv,text/plain"
                            disabled={noEmployeeId}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                setFile(f ?? null);
                                setFileLastModified(f?.lastModified ?? null);
                                setReportGeneratedAt(null);
                                setPreview(null);
                                setUnmapped([]);
                                setErrors([]);
                                setReconcile(null);
                                setReconcileReviewed(false);
                                setApplyResult(null);
                                setPastCountFromPreview(0);
                                setUserDeskTypes([]);
                            }}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            disabled={noEmployeeId || !file || previewLoading}
                            onClick={onPreview}
                        >
                            {previewLoading ? 'Loading…' : 'Preview'}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={noEmployeeId || applyLoading || !canApply}
                            onClick={onApply}
                        >
                            {applyLoading ? 'Applying…' : 'Apply import'}
                        </Button>
                        {hasReconcileChanges && !reconcileReviewed && (
                            <span className="text-sm text-muted-foreground">Review changes below and check &quot;I&apos;ve reviewed&quot; to enable Apply.</span>
                        )}
                    </div>

                    {errors.length > 0 && (
                        <ul className="list-inside list-disc rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    )}

                    {unmapped.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            Unmapped desk codes (imported as generic): {unmapped.join(', ')}
                        </p>
                    )}

                    {pastCountFromPreview > 0 && (
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                            {pastCountFromPreview} shift{pastCountFromPreview !== 1 ? 's' : ''} in the past were not added.
                        </p>
                    )}

                    {fileLastModified != null && (
                        <p className="text-sm text-muted-foreground">
                            File last modified: {new Date(fileLastModified).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    )}
                    {reportGeneratedAt != null && (
                        <p className="text-sm text-muted-foreground">
                            Report generated: {new Date(reportGeneratedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    )}

                    {preview && preview.length > 0 && !applyResult && (
                        <div className="overflow-x-auto rounded-lg border border-border">
                            {(() => {
                                const willImport = preview.filter((r) => !r.in_past).length;
                                const pastCount = preview.filter((r) => r.in_past).length;
                                const unmappedCount = preview.filter((r) => r.unmapped_desk).length;
                                return (
                                    <div className="border-b border-border bg-muted/30 p-3 text-sm">
                                        <p className="font-medium text-foreground">Import overview</p>
                                        <ul className="mt-1 list-inside list-disc text-muted-foreground">
                                            <li><span className="text-foreground">{willImport}</span> shift{willImport !== 1 ? 's' : ''} will be imported</li>
                                            {pastCount > 0 && (
                                                <li><span className="text-amber-600 dark:text-amber-400">{pastCount}</span> in the past (not imported)</li>
                                            )}
                                            {unmappedCount > 0 && (
                                                <li><span className="text-muted-foreground">{unmappedCount}</span> unmapped desk code{unmappedCount !== 1 ? 's' : ''}</li>
                                            )}
                                        </ul>
                                    </div>
                                );
                            })()}

                            {reconcile && (reconcile.to_add.length > 0 || reconcile.to_remove.length > 0 || reconcile.to_modify.length > 0) && (
                                <div className="border-b border-border bg-muted/20 p-3">
                                    <p className="font-medium text-foreground mb-2">Review changes before import</p>
                                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                                        {reconcile.to_add.length > 0 && (
                                            <div>
                                                <p className="font-medium text-green-700 dark:text-green-400">Add ({reconcile.to_add.length})</p>
                                                <ul className="mt-1 list-inside list-disc text-muted-foreground max-h-32 overflow-y-auto">
                                                    {reconcile.to_add.slice(0, 10).map((r, i) => (
                                                        <li key={i}>{r.shift_date} {r.time_code} {r.desk_code}</li>
                                                    ))}
                                                </ul>
                                                {reconcile.to_add.length > 10 && <p className="text-xs text-muted-foreground mt-0.5">+{reconcile.to_add.length - 10} more</p>}
                                            </div>
                                        )}
                                        {reconcile.to_remove.length > 0 && (
                                            <div>
                                                <p className="font-medium text-destructive">Remove ({reconcile.to_remove.length})</p>
                                                <ul className="mt-1 list-inside list-disc text-muted-foreground max-h-32 overflow-y-auto">
                                                    {reconcile.to_remove.slice(0, 10).map((s, i) => (
                                                        <li key={i}>{formatDate(s.start_time_utc)} — {s.position_name}</li>
                                                    ))}
                                                </ul>
                                                {reconcile.to_remove.length > 10 && <p className="text-xs text-muted-foreground mt-0.5">+{reconcile.to_remove.length - 10} more</p>}
                                            </div>
                                        )}
                                        {reconcile.to_modify.length > 0 && (
                                            <div>
                                                <p className="font-medium text-amber-700 dark:text-amber-400">Modified ({reconcile.to_modify.length})</p>
                                                <ul className="mt-1 space-y-1 text-muted-foreground max-h-32 overflow-y-auto">
                                                    {reconcile.to_modify.slice(0, 5).map((m, i) => (
                                                        <li key={i} className="text-xs">
                                                            {m.position_name} · {formatDate(m.start_time_utc)}: {Object.entries(m.changes).map(([k, v]) => `${k}: ${String(v.old)} → ${String(v.new)}`).join('; ')}
                                                        </li>
                                                    ))}
                                                </ul>
                                                {reconcile.to_modify.length > 5 && <p className="text-xs text-muted-foreground mt-0.5">+{reconcile.to_modify.length - 5} more</p>}
                                            </div>
                                        )}
                                    </div>
                                    <label className="mt-3 flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={reconcileReviewed}
                                            onChange={(e) => setReconcileReviewed(e.target.checked)}
                                            className="rounded border-input"
                                        />
                                        <span className="text-sm">I&apos;ve reviewed these changes</span>
                                    </label>
                                </div>
                            )}

                            <p className="p-2 text-xs text-muted-foreground">
                                Remove or edit rows below; you can change desk type to match your workgroup. Then click Apply import. Only current/future rows are imported.
                            </p>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-2 border-b border-border/50">
                                <div className="min-h-[280px]">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Calendar</p>
                                    <FullCalendar
                                        plugins={[dayGridPlugin, interactionPlugin]}
                                        initialView="dayGridMonth"
                                        headerToolbar={{ left: 'title', right: 'prev,next today' }}
                                        events={previewCalendarEvents}
                                        eventContent={(arg) => (
                                            <div className={`truncate px-1 py-0.5 text-xs rounded ${arg.event.extendedProps?.inPast ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' : 'bg-primary/15 text-primary-foreground'}`}>
                                                {arg.event.title}
                                            </div>
                                        )}
                                        height="auto"
                                        contentHeight="auto"
                                        aspectRatio={1.6}
                                    />
                                </div>
                                <div className="overflow-x-auto">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Table</p>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-2 text-left">Date</th>
                                        <th className="p-2 text-left">Time</th>
                                        <th className="p-2 text-left">Desk</th>
                                        <th className="p-2 text-left">Desk type</th>
                                        <th className="p-2 text-left">Start (UTC)</th>
                                        <th className="p-2 text-right w-28">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((row, i) => {
                                        const wg = userDeskTypes.find((w) => w.workgroup_id === row.workgroup_id);
                                        const deskTypeOptions = wg?.desk_types ?? [];
                                        return (
                                            <tr key={i} className={`border-b border-border/70 ${row.in_past ? 'bg-muted/20' : ''}`}>
                                                <td className="p-2">
                                                    {row.shift_date}
                                                    {row.in_past && (
                                                        <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" title="This shift is in the past and will not be imported">
                                                            Past
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2">{row.time_code}</td>
                                                <td className="p-2">
                                                    {row.desk_code}
                                                    {row.unmapped_desk && (
                                                        <span className="ml-1 text-muted-foreground" title="Unmapped code">*</span>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    {deskTypeOptions.length > 0 ? (
                                                        <select
                                                            className="h-7 min-w-[8rem] rounded border border-input bg-background px-2 text-xs"
                                                            value={row.desk_type}
                                                            onChange={(e) => {
                                                                const code = e.target.value;
                                                                const opt = deskTypeOptions.find((d) => d.code === code);
                                                                setPreview((prev) => {
                                                                    if (!prev) return null;
                                                                    const next = [...prev];
                                                                    next[i] = { ...row, desk_type: code, position_name: row.desk_code ?? row.position_name };
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            {deskTypeOptions.map((d) => (
                                                                <option key={d.code} value={d.code}>{d.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="text-muted-foreground">{row.desk_type}</span>
                                                    )}
                                                </td>
                                                <td className="p-2">{row.start_utc?.slice(0, 16)}</td>
                                                <td className="p-2 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs mr-0.5"
                                                        onClick={() => {
                                                            setEditPreviewIndex(i);
                                                            setEditPreviewDate(row.shift_date);
                                                            setEditPreviewTimeCode(row.time_code);
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs text-destructive hover:text-destructive"
                                                        onClick={() => removePreviewRow(i)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {applyResult && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/40">
                            <p className="font-medium text-green-800 dark:text-green-200">{applyResult.message}</p>
                            <ul className="mt-2 list-inside list-disc text-sm text-green-700 dark:text-green-300">
                                <li>Created: {applyResult.created}</li>
                                <li>Updated: {applyResult.updated}</li>
                                <li>Skipped: {applyResult.skipped}</li>
                                {(applyResult.past_count ?? 0) > 0 && (
                                    <li>{applyResult.past_count} shift{(applyResult.past_count ?? 0) !== 1 ? 's' : ''} in the past were not added</li>
                                )}
                                {applyResult.conflict > 0 && <li>Conflicts (shift has active post): {applyResult.conflict}</li>}
                                {applyResult.missing_shift_ids.length > 0 && (
                                    <li>Shifts on your board not in file: {applyResult.missing_shift_ids.length} (reconcile below)</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {missingShifts.length > 0 && (
                        <div className="rounded-lg border border-border p-4">
                            <h2 className="font-medium mb-2">Reconcile shifts not in import</h2>
                            <p className="text-sm text-muted-foreground mb-3">
                                These shifts are on your board but were not in the file. Keep them, move to a different date, or remove. Deleting will remove the shift and any post for it.
                            </p>
                            <div className="mb-3 flex gap-2">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={deleteAllMissingLoading}
                                    onClick={onDeleteAllMissing}
                                >
                                    {deleteAllMissingLoading ? 'Deleting…' : 'Delete all'}
                                </Button>
                            </div>
                            <ul className="space-y-2">
                                {missingShifts.map((s) => (
                                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/70 bg-muted/20 p-2 text-sm">
                                        <span>
                                            {s.position_name} · {formatDate(s.start_time_utc)}
                                        </span>
                                        <span className="flex gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => setDismissedMissingIds((prev) => new Set([...prev, s.id]))}
                                            >
                                                Keep
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => {
                                                    const start = s.start_time_utc.slice(0, 10);
                                                    setMoveShift(s);
                                                    setMoveDate(start);
                                                    setMoveTime(s.start_time_utc.slice(11, 16) || '');
                                                }}
                                            >
                                                Move date
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => onDeleteMissing(s.id)}
                                            >
                                                Delete
                                            </Button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {historyRuns.length > 0 && (
                        <div className="rounded-lg border border-border p-4">
                            <h2 className="font-medium mb-2">Recent imports</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="p-2 text-left">Date</th>
                                            <th className="p-2 text-right">Created</th>
                                            <th className="p-2 text-right">Updated</th>
                                            <th className="p-2 text-right">Skipped</th>
                                            <th className="p-2 text-right">Missing</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyRuns.map((r) => (
                                            <tr key={r.id} className="border-b border-border/70">
                                                <td className="p-2">{formatDate(r.created_at)}</td>
                                                <td className="p-2 text-right">{r.created_count}</td>
                                                <td className="p-2 text-right">{r.updated_count}</td>
                                                <td className="p-2 text-right">{r.skipped_count}</td>
                                                <td className="p-2 text-right">{r.missing_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </SettingsLayout>

            <Dialog open={editPreviewIndex != null} onOpenChange={(open) => !open && setEditPreviewIndex(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit shift</DialogTitle>
                    </DialogHeader>
                    {editPreviewIndex != null && preview?.[editPreviewIndex] && (
                        <>
                            <div className="grid gap-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={editPreviewDate}
                                    onChange={(e) => setEditPreviewDate(e.target.value)}
                                />
                                <Label>Time code (e.g. 06, 14)</Label>
                                <Input
                                    type="text"
                                    value={editPreviewTimeCode}
                                    onChange={(e) => setEditPreviewTimeCode(e.target.value)}
                                    placeholder="06"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setEditPreviewIndex(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={saveEditPreviewRow} disabled={!editPreviewDate.trim() || !editPreviewTimeCode.trim()}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!moveShift} onOpenChange={(open) => !open && setMoveShift(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move shift to new date</DialogTitle>
                    </DialogHeader>
                    {moveShift && (
                        <>
                            <p className="text-sm text-muted-foreground">
                                {moveShift.position_name} — choose the new date (and optional time).
                            </p>
                            <div className="grid gap-2">
                                <Label>New date</Label>
                                <Input
                                    type="date"
                                    value={moveDate}
                                    onChange={(e) => setMoveDate(e.target.value)}
                                />
                                <Label>Time (optional, keeps same time if blank)</Label>
                                <Input
                                    type="time"
                                    value={moveTime}
                                    onChange={(e) => setMoveTime(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setMoveShift(null)}>
                                    Cancel
                                </Button>
                                <Button disabled={!moveDate || moveSubmitting} onClick={onMoveSubmit}>
                                    {moveSubmitting ? 'Moving…' : 'Move shift'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
