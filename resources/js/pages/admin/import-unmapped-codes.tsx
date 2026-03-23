import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { getCsrfToken } from '@/lib/csrf';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    {
        title: 'Import Unmapped Codes',
        href: '/app/admin/import-unmapped-codes',
    },
];

type Code = {
    id: number;
    source: string;
    code_type: string;
    code: string;
    seen_count: number;
    first_seen_at: string | null;
    last_seen_at: string | null;
    examples: UnmappedExample[] | null;
};

type UnmappedExample = {
    user_name?: string;
    employee_id?: string | null;
    shift_date?: string | null;
    time_code?: string | null;
    reason?: string;
    date?: string;
};

function formatExample(ex: UnmappedExample): string {
    const user = ex.user_name ?? 'Unknown';
    const emp = ex.employee_id ? ` (${ex.employee_id})` : '';
    const when = ex.shift_date
        ? ` · ${ex.shift_date}${ex.time_code ? ` @ ${ex.time_code}` : ''}`
        : ex.date
          ? ` · ${ex.date}`
          : ex.reason
            ? ` · ${ex.reason}`
            : '';
    return `${user}${emp}${when}`;
}

type DeskTypeOption = { id: number; code: string; label: string };
type WorkgroupOption = {
    id: number;
    name: string;
    desk_types: DeskTypeOption[];
};

export default function ImportUnmappedCodes({
    codes = [],
    workgroups = [],
}: {
    codes: Code[];
    workgroups: WorkgroupOption[];
}) {
    const page = usePage().props as unknown as {
        flash?: { success?: string; error?: string };
    };
    const flash = page.flash;

    const [addModal, setAddModal] = useState<{ code: Code } | null>(null);
    const [addWorkgroupId, setAddWorkgroupId] = useState<number | ''>('');
    const [addDeskTypeId, setAddDeskTypeId] = useState<number | ''>('');
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [bulkRemoving, setBulkRemoving] = useState(false);
    const [clearingAll, setClearingAll] = useState(false);

    const selectedWorkgroup = addWorkgroupId
        ? workgroups.find((w) => w.id === addWorkgroupId)
        : null;
    const deskTypeOptions = selectedWorkgroup?.desk_types ?? [];

    const allSelected = codes.length > 0 && selectedIds.length === codes.length;

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds([]);
        else setSelectedIds(codes.map((c) => c.id));
    };

    const openAddModal = (code: Code) => {
        setAddModal({ code });
        setAddWorkgroupId('');
        setAddDeskTypeId('');
        setAddError(null);
    };

    const closeAddModal = () => {
        if (!addSubmitting) {
            setAddModal(null);
            setAddWorkgroupId('');
            setAddDeskTypeId('');
            setAddError(null);
        }
    };

    const submitAddToWorkgroup = async () => {
        if (!addModal || addWorkgroupId === '') return;
        setAddSubmitting(true);
        setAddError(null);
        try {
            const res = await fetch(
                '/app/admin/schedule-import/unmapped-add-to-workgroup',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        unmapped_code_id: addModal.code.id,
                        workgroup_id: addWorkgroupId,
                        desk_type_id:
                            addDeskTypeId === '' ? null : addDeskTypeId,
                    }),
                },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setAddError(data.message || 'Request failed');
                return;
            }
            setAddModal(null);
            router.reload();
        } finally {
            setAddSubmitting(false);
        }
    };

    const removeOne = (id: number) => {
        if (
            !confirm(
                'Remove this code from the unmapped list? (It may reappear on a future import if still unmatched.)',
            )
        )
            return;
        setRemovingId(id);
        router.delete(`/app/admin/schedule-import/unmapped-codes/${id}`, {
            preserveScroll: true,
            onFinish: () => setRemovingId(null),
        });
    };

    const removeSelected = () => {
        if (selectedIds.length === 0) return;
        if (
            !confirm(
                `Remove ${selectedIds.length} code(s) from the unmapped list? (They may reappear on a future import if still unmatched.)`,
            )
        )
            return;
        setBulkRemoving(true);
        router.post(
            '/app/admin/schedule-import/unmapped-codes/bulk-destroy',
            { ids: selectedIds },
            {
                preserveScroll: true,
                onFinish: () => {
                    setBulkRemoving(false);
                    setSelectedIds([]);
                },
            },
        );
    };

    const clearAll = () => {
        if (
            !confirm(
                'Clear every unmapped code from this list? This cannot be undone.',
            )
        )
            return;
        setClearingAll(true);
        router.post(
            '/app/admin/schedule-import/unmapped-codes/clear-all',
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setClearingAll(false);
                    setSelectedIds([]);
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Import Unmapped Codes" />
            <div className="space-y-4 p-4">
                <h1 className="text-2xl font-semibold">
                    Import Unmapped Codes
                </h1>
                <p className="text-sm text-muted-foreground">
                    Desk or time codes that appeared in schedule CSV imports but
                    were not found in any workgroup position range. For desk
                    codes you can add them to a workgroup below; otherwise add
                    matching position ranges in Workgroup Manager. You can also
                    remove codes from this list if you have resolved them
                    elsewhere or want to dismiss the reminder.
                </p>

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

                {codes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={toggleSelectAll}
                            />
                            Select all
                        </label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={selectedIds.length === 0 || bulkRemoving}
                            onClick={removeSelected}
                        >
                            {bulkRemoving
                                ? 'Removing…'
                                : `Remove selected (${selectedIds.length})`}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={clearingAll}
                            onClick={clearAll}
                        >
                            {clearingAll ? 'Clearing…' : 'Clear all'}
                        </Button>
                    </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-max text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="w-10 p-2" aria-label="Select" />
                                <th className="p-2 text-left">Type</th>
                                <th className="p-2 text-left">Code</th>
                                <th className="p-2 text-right">Seen</th>
                                <th className="p-2 text-left">First seen</th>
                                <th className="p-2 text-left">Last seen</th>
                                <th className="min-w-[200px] p-2 text-left">
                                    User / Shift
                                </th>
                                <th className="w-52 p-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codes.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="p-4 text-center text-muted-foreground"
                                    >
                                        No unmapped codes.
                                    </td>
                                </tr>
                            ) : (
                                codes.map((c) => (
                                    <tr
                                        key={c.id}
                                        className="border-b border-border/70"
                                    >
                                        <td className="p-2 align-middle">
                                            <Checkbox
                                                checked={selectedIds.includes(
                                                    c.id,
                                                )}
                                                onCheckedChange={() =>
                                                    toggleSelect(c.id)
                                                }
                                                aria-label={`Select ${c.code_type} ${c.code}`}
                                            />
                                        </td>
                                        <td className="p-2">{c.code_type}</td>
                                        <td className="p-2 font-mono">
                                            {c.code}
                                        </td>
                                        <td className="p-2 text-right">
                                            {c.seen_count}
                                        </td>
                                        <td className="p-2">
                                            {c.first_seen_at
                                                ? new Date(
                                                      c.first_seen_at,
                                                  ).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="p-2">
                                            {c.last_seen_at
                                                ? new Date(
                                                      c.last_seen_at,
                                                  ).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="p-2 text-sm text-muted-foreground">
                                            {Array.isArray(c.examples) &&
                                            c.examples.length > 0 ? (
                                                <ul className="list-inside space-y-0.5">
                                                    {(
                                                        c.examples as UnmappedExample[]
                                                    ).map((ex, i) => (
                                                        <li key={i}>
                                                            {formatExample(ex)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="p-2 text-right">
                                            <div className="flex flex-wrap justify-end gap-1">
                                                {c.code_type === 'desk' && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() =>
                                                            openAddModal(c)
                                                        }
                                                    >
                                                        Add to workgroup
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs text-muted-foreground"
                                                    onClick={() =>
                                                        removeOne(c.id)
                                                    }
                                                    disabled={
                                                        removingId === c.id
                                                    }
                                                >
                                                    {removingId === c.id
                                                        ? '…'
                                                        : 'Remove'}
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

            <Dialog
                open={!!addModal}
                onOpenChange={(open) => !open && closeAddModal()}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add desk code to workgroup</DialogTitle>
                    </DialogHeader>
                    {addModal && (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Add &quot;
                                <span className="font-mono font-medium">
                                    {addModal.code.code}
                                </span>
                                &quot; as a position in a workgroup. Choose an
                                existing desk type or create a new one.
                            </p>
                            <div className="grid gap-4 py-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="add-wg">Workgroup</Label>
                                    <select
                                        id="add-wg"
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                        value={
                                            addWorkgroupId === ''
                                                ? ''
                                                : addWorkgroupId
                                        }
                                        onChange={(e) => {
                                            setAddWorkgroupId(
                                                e.target.value === ''
                                                    ? ''
                                                    : Number(e.target.value),
                                            );
                                            setAddDeskTypeId('');
                                        }}
                                    >
                                        <option value="">— Select —</option>
                                        {workgroups.map((wg) => (
                                            <option key={wg.id} value={wg.id}>
                                                {wg.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {selectedWorkgroup && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="add-dt">
                                            Desk type
                                        </Label>
                                        <select
                                            id="add-dt"
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                            value={
                                                addDeskTypeId === ''
                                                    ? ''
                                                    : addDeskTypeId
                                            }
                                            onChange={(e) =>
                                                setAddDeskTypeId(
                                                    e.target.value === ''
                                                        ? ''
                                                        : Number(
                                                              e.target.value,
                                                          ),
                                                )
                                            }
                                        >
                                            <option value="">
                                                New desk type (&quot;
                                                {addModal.code.code}&quot;)
                                            </option>
                                            {deskTypeOptions.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.label} ({d.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            {addError && (
                                <p className="text-sm text-destructive">
                                    {addError}
                                </p>
                            )}
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeAddModal}
                                    disabled={addSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={submitAddToWorkgroup}
                                    disabled={
                                        addSubmitting || addWorkgroupId === ''
                                    }
                                >
                                    {addSubmitting ? 'Adding…' : 'Add'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
