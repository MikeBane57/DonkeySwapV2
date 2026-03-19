import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    { title: 'Import Unmapped Codes', href: '/app/admin/import-unmapped-codes' },
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
type WorkgroupOption = { id: number; name: string; desk_types: DeskTypeOption[] };

export default function ImportUnmappedCodes({
    codes = [],
    workgroups = [],
}: {
    codes: Code[];
    workgroups: WorkgroupOption[];
}) {
    const [addModal, setAddModal] = useState<{ code: Code } | null>(null);
    const [addWorkgroupId, setAddWorkgroupId] = useState<number | ''>('');
    const [addDeskTypeId, setAddDeskTypeId] = useState<number | ''>('');
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const selectedWorkgroup = addWorkgroupId
        ? workgroups.find((w) => w.id === addWorkgroupId)
        : null;
    const deskTypeOptions = selectedWorkgroup?.desk_types ?? [];

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
            const res = await fetch('/app/admin/schedule-import/unmapped-add-to-workgroup', {
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
                    desk_type_id: addDeskTypeId === '' ? null : addDeskTypeId,
                }),
            });
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Import Unmapped Codes" />
            <div className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Import Unmapped Codes</h1>
                <p className="text-muted-foreground text-sm">
                    Desk or time codes that appeared in schedule CSV imports but were not found in any workgroup position range. For desk codes you can add them to a workgroup below; otherwise add matching position ranges in Workgroup Manager.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2 text-left">Type</th>
                                <th className="p-2 text-left">Code</th>
                                <th className="p-2 text-right">Seen</th>
                                <th className="p-2 text-left">First seen</th>
                                <th className="p-2 text-left">Last seen</th>
                                <th className="p-2 text-left min-w-[200px]">User / Shift</th>
                                <th className="p-2 text-right w-40">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                                        No unmapped codes.
                                    </td>
                                </tr>
                            ) : (
                                codes.map((c) => (
                                    <tr key={c.id} className="border-b border-border/70">
                                        <td className="p-2">{c.code_type}</td>
                                        <td className="p-2 font-mono">{c.code}</td>
                                        <td className="p-2 text-right">{c.seen_count}</td>
                                        <td className="p-2">{c.first_seen_at ? new Date(c.first_seen_at).toLocaleString() : '—'}</td>
                                        <td className="p-2">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : '—'}</td>
                                        <td className="p-2 text-sm text-muted-foreground">
                                            {Array.isArray(c.examples) && c.examples.length > 0 ? (
                                                <ul className="list-inside space-y-0.5">
                                                    {(c.examples as UnmappedExample[]).map((ex, i) => (
                                                        <li key={i}>{formatExample(ex)}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="p-2 text-right">
                                            {c.code_type === 'desk' ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => openAddModal(c)}
                                                >
                                                    Add to workgroup
                                                </Button>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={!!addModal} onOpenChange={(open) => !open && closeAddModal()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add desk code to workgroup</DialogTitle>
                    </DialogHeader>
                    {addModal && (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Add &quot;<span className="font-mono font-medium">{addModal.code.code}</span>&quot; as a position in a workgroup. Choose an existing desk type or create a new one.
                            </p>
                            <div className="grid gap-4 py-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="add-wg">Workgroup</Label>
                                    <select
                                        id="add-wg"
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                        value={addWorkgroupId === '' ? '' : addWorkgroupId}
                                        onChange={(e) => {
                                            setAddWorkgroupId(e.target.value === '' ? '' : Number(e.target.value));
                                            setAddDeskTypeId('');
                                        }}
                                    >
                                        <option value="">— Select —</option>
                                        {workgroups.map((wg) => (
                                            <option key={wg.id} value={wg.id}>{wg.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {selectedWorkgroup && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="add-dt">Desk type</Label>
                                        <select
                                            id="add-dt"
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                            value={addDeskTypeId === '' ? '' : addDeskTypeId}
                                            onChange={(e) => setAddDeskTypeId(e.target.value === '' ? '' : Number(e.target.value))}
                                        >
                                            <option value="">New desk type (&quot;{addModal.code.code}&quot;)</option>
                                            {deskTypeOptions.map((d) => (
                                                <option key={d.id} value={d.id}>{d.label} ({d.code})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            {addError && (
                                <p className="text-sm text-destructive">{addError}</p>
                            )}
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeAddModal} disabled={addSubmitting}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={submitAddToWorkgroup}
                                    disabled={addSubmitting || addWorkgroupId === ''}
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
