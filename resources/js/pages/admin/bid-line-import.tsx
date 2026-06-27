import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Bid line import', href: '/app/admin/bid-lines' },
];

type SourceFileMeta = {
    filename: string;
    title: string | null;
};

type ImportRow = {
    id: number;
    bid_year: number;
    is_current: boolean;
    file_hash: string;
    original_filename: string;
    title: string | null;
    created_at: string;
    uploaded_by_name: string | null;
    line_count: number;
    source_files: SourceFileMeta[] | null;
};

type FileRow = {
    key: string;
    file: File | null;
    title: string;
};

function newRow(): FileRow {
    return {
        key:
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now() + Math.random()),
        file: null,
        title: '',
    };
}

function collectUploadErrors(errors: Record<string, string>): string[] {
    return Object.entries(errors)
        .filter(([key]) => key === 'files' || key.startsWith('files.'))
        .map(([, message]) => message);
}

export default function AdminBidLineImport({
    imports,
}: {
    imports: ImportRow[];
}) {
    const page = usePage<{
        errors?: Record<string, string>;
        flash?: { success?: string; error?: string };
    }>();
    const errors = page.props.errors ?? {};
    const flash = page.props.flash;
    const fileErrors = collectUploadErrors(errors);

    const [bidYear, setBidYear] = useState(new Date().getFullYear());
    const [batchTitle, setBatchTitle] = useState('');
    const [rows, setRows] = useState<FileRow[]>(() => [newRow()]);
    const [processing, setProcessing] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const addRow = useCallback(() => {
        setRows((r) => [...r, newRow()]);
    }, []);

    const removeRow = useCallback((key: string) => {
        setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.key !== key)));
    }, []);

    const updateRow = useCallback(
        (key: string, patch: Partial<Pick<FileRow, 'file' | 'title'>>) => {
            setRows((r) =>
                r.map((row) => (row.key === key ? { ...row, ...patch } : row)),
            );
        },
        [],
    );

    const readyRows = rows.filter((r) => r.file);
    const canSubmit = readyRows.length > 0 && !processing;

    const submitImport = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (readyRows.length === 0) {
            setLocalError('Choose at least one CSV file to import.');
            return;
        }

        setProcessing(true);
        router.post(
            '/app/admin/bid-lines',
            {
                bid_year: bidYear,
                batch_title: batchTitle.trim(),
                files: readyRows.map((row) => row.file as File),
                titles: readyRows.map((row) => row.title.trim()),
            },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: () => setProcessing(false),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bid line import" />
            <div className="mx-auto max-w-3xl space-y-8 p-4 pb-12">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/app/admin">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Bid line import
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Upload one or more SWALife-style CSVs for the same
                            bid year (identical date columns). Each file can
                            carry a workgroup label; lines are merged into one
                            master import per year.
                        </p>
                    </div>
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

                <form
                    className="space-y-4 rounded-xl border border-sidebar-border/70 p-4"
                    onSubmit={submitImport}
                >
                    <div className="space-y-2">
                        <Label htmlFor="bid_year">Bid year (Feb start)</Label>
                        <Input
                            id="bid_year"
                            type="number"
                            min={2000}
                            max={2100}
                            value={bidYear}
                            onChange={(e) =>
                                setBidYear(Number(e.target.value) || 2026)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="batch_title">
                            Import title (optional)
                        </Label>
                        <Input
                            id="batch_title"
                            placeholder="e.g. 2026 combined — all bases"
                            value={batchTitle}
                            onChange={(e) => setBatchTitle(e.target.value)}
                            maxLength={160}
                        />
                        <p className="text-xs text-muted-foreground">
                            Shown in history and bid tools hub. Per-file labels
                            below are stored on each line.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <Label>CSV files & workgroup labels</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addRow}
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Add file
                            </Button>
                        </div>
                        <ul className="space-y-3">
                            {rows.map((row, idx) => (
                                <li
                                    key={row.key}
                                    className="rounded-lg border border-sidebar-border/60 p-3"
                                >
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            File {idx + 1}
                                        </span>
                                        {rows.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 text-muted-foreground"
                                                onClick={() =>
                                                    removeRow(row.key)
                                                }
                                                aria-label="Remove row"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label
                                                className="text-xs"
                                                htmlFor={`file-${row.key}`}
                                            >
                                                CSV
                                            </Label>
                                            <Input
                                                id={`file-${row.key}`}
                                                type="file"
                                                className="text-sm file:mr-2 file:text-xs"
                                                onChange={(e) =>
                                                    updateRow(row.key, {
                                                        file:
                                                            e.target
                                                                .files?.[0] ??
                                                            null,
                                                    })
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                SWALife-style CSV (any
                                                extension is fine).
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label
                                                className="text-xs"
                                                htmlFor={`title-${row.key}`}
                                            >
                                                Workgroup / file label
                                            </Label>
                                            <Input
                                                id={`title-${row.key}`}
                                                placeholder="e.g. DEN Captains"
                                                value={row.title}
                                                maxLength={120}
                                                onChange={(e) =>
                                                    updateRow(row.key, {
                                                        title: e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {localError && (
                        <p className="text-sm text-destructive">{localError}</p>
                    )}
                    {fileErrors.length > 0 && (
                        <ul className="space-y-1 text-sm text-destructive">
                            {fileErrors.map((message, i) => (
                                <li key={i}>{message}</li>
                            ))}
                        </ul>
                    )}
                    {errors.bid_year && (
                        <p className="text-sm text-destructive">
                            {errors.bid_year}
                        </p>
                    )}
                    {errors.batch_title && (
                        <p className="text-sm text-destructive">
                            {errors.batch_title}
                        </p>
                    )}

                    <Button type="submit" disabled={!canSubmit}>
                        <Upload className="mr-2 h-4 w-4" />
                        {processing
                            ? 'Importing…'
                            : readyRows.length > 1
                              ? `Import ${readyRows.length} files`
                              : 'Import'}
                    </Button>
                </form>

                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Recent uploads
                    </h2>
                    <ul className="space-y-2">
                        {imports.map((row) => (
                            <li
                                key={row.id}
                                className="rounded-lg border border-sidebar-border/60 p-3 text-sm"
                            >
                                <div className="flex flex-wrap justify-between gap-2">
                                    <span className="font-medium">
                                        {row.bid_year}
                                        {row.is_current && (
                                            <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                                                current
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {row.line_count} lines
                                    </span>
                                </div>
                                {row.title && (
                                    <div className="mt-1 font-medium text-foreground">
                                        {row.title}
                                    </div>
                                )}
                                <div className="mt-1 text-muted-foreground">
                                    {row.original_filename}
                                </div>
                                {row.source_files &&
                                    row.source_files.length > 0 && (
                                        <ul className="mt-2 space-y-0.5 border-t border-sidebar-border/50 pt-2 text-xs text-muted-foreground">
                                            {row.source_files.map((s, i) => (
                                                <li key={i}>
                                                    <span className="font-mono">
                                                        {s.filename}
                                                    </span>
                                                    {s.title && (
                                                        <span>
                                                            {' '}
                                                            — {s.title}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {row.uploaded_by_name ?? '—'} ·{' '}
                                    {new Date(row.created_at).toLocaleString()}·{' '}
                                    <code className="rounded bg-muted px-1">
                                        {row.file_hash.slice(0, 12)}…
                                    </code>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </AppLayout>
    );
}
