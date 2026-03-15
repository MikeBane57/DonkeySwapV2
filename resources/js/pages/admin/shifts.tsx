import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, UserPlus } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Shift Manager', href: '/app/admin/shifts' },
];

type ShiftRow = {
    id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    workgroup_id: number;
    workgroup_name: string;
    position_name: string;
    desk_type: string | null;
    start_time_utc: string;
    end_time_utc: string;
    regulatory: boolean;
};

type UserOption = { id: number; name: string; email: string; workgroup_ids: number[] };
type DeskTypeOption = { code: string; label: string };
type WorkgroupOption = {
    id: number;
    name: string;
    allowed_start_times: { start_time: string; default_duration_minutes: number }[];
    desk_types?: DeskTypeOption[];
    positions: { label: string; type?: string; shift_type?: string }[];
};

const DESK_TYPE_LABELS: Record<string, string> = {
    domestic_dispatch: 'Domestic',
    assistant_desk: 'Assistant',
    etops: 'ETOPS',
    intl: 'INTL',
    regional: 'Regional',
    sector: 'Sector',
    nextday: 'NextDay',
    extra: 'Extra',
};

function formatDateTimeUtc(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDeskTypeLabel(workgroup: WorkgroupOption | undefined, code: string | null): string {
    if (!code) return '—';
    const label = workgroup?.desk_types?.find((d) => d.code === code)?.label;
    return label ?? DESK_TYPE_LABELS[code] ?? code;
}

export default function AdminShifts() {
    const { shifts = [], users = [], workgroups = [], filters = {}, flash } = usePage().props as {
        shifts: ShiftRow[];
        users: UserOption[];
        workgroups: WorkgroupOption[];
        filters: { user_id?: string; date_from?: string; date_to?: string; workgroup_id?: string };
        flash?: { success?: string; error?: string };
    };
    const [success, setSuccess] = useState(flash?.success ?? null);
    const [addOpen, setAddOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const [filterUser, setFilterUser] = useState(filters.user_id ?? '');
    const [filterDateFrom, setFilterDateFrom] = useState(filters.date_from ?? '');
    const [filterDateTo, setFilterDateTo] = useState(filters.date_to ?? '');
    const [filterWorkgroup, setFilterWorkgroup] = useState(filters.workgroup_id ?? '');

    const [addForm, setAddForm] = useState({
        user_id: '',
        workgroup_id: '',
        position_name: '',
        desk_type: '',
        start_date: '',
        start_time: '06:00',
        end_date: '',
        end_time: '',
        regulatory: false,
    });
    const [moveUserId, setMoveUserId] = useState('');

    const selectedUser = addForm.user_id ? users.find((u) => u.id === parseInt(addForm.user_id, 10)) : null;
    const allowedWorkgroupsForUser = selectedUser
        ? workgroups.filter((wg) => selectedUser.workgroup_ids?.includes(wg.id) ?? false)
        : workgroups;
    const selectedShiftsForMove = shifts.filter((s) => selectedIds.has(s.id));
    const workgroupIdsOfSelectedShifts = [...new Set(selectedShiftsForMove.map((s) => s.workgroup_id))];
    const allowedUsersForMove = workgroupIdsOfSelectedShifts.length > 0
        ? users.filter((u) => workgroupIdsOfSelectedShifts.every((wgId) => u.workgroup_ids?.includes(wgId)))
        : users;
    const selectedWorkgroup = addForm.workgroup_id ? workgroups.find((wg) => wg.id === parseInt(addForm.workgroup_id, 10)) : null;
    const selectedWorkgroupAllowed = selectedWorkgroup && selectedUser
        ? selectedUser.workgroup_ids?.includes(selectedWorkgroup.id)
        : true;
    const positionOptions = selectedWorkgroup?.positions ?? [];
    const deskTypesInWorkgroup = (() => {
        const fromDeskTypes = selectedWorkgroup?.desk_types?.map((d) => d.code).filter(Boolean);
        if (fromDeskTypes && fromDeskTypes.length > 0) return [...new Set(fromDeskTypes)];
        return [...new Set(positionOptions.map((p) => (p as { shift_type?: string }).shift_type).filter(Boolean))] as string[];
    })();
    const positionOptionsFiltered = addForm.desk_type
        ? positionOptions.filter((p) => (p as { shift_type?: string }).shift_type === addForm.desk_type)
        : positionOptions;

    const [rotationForm, setRotationForm] = useState({
        date_from: '',
        date_to: '',
        pattern: '5, 3, 5, 5',
    });

    const applyFilters = () => {
        const params: Record<string, string> = {};
        if (filterUser) params.user_id = filterUser;
        if (filterDateFrom) params.date_from = filterDateFrom;
        if (filterDateTo) params.date_to = filterDateTo;
        if (filterWorkgroup) params.workgroup_id = filterWorkgroup;
        router.get('/app/admin/shifts', params);
    };

    const clearFilters = () => {
        setFilterUser('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterWorkgroup('');
        router.get('/app/admin/shifts');
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === shifts.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(shifts.map((s) => s.id)));
    };

    const openAdd = () => {
        const firstUser = users[0];
        const firstAllowedWgId = firstUser?.workgroup_ids?.length ? firstUser.workgroup_ids[0] : workgroups[0]?.id;
        setAddForm({
            user_id: firstUser?.id?.toString() ?? '',
            workgroup_id: firstAllowedWgId != null ? String(firstAllowedWgId) : '',
            position_name: '',
            desk_type: '',
            start_date: new Date().toISOString().slice(0, 10),
            start_time: '06:00',
            end_date: '',
            end_time: '',
            regulatory: false,
        });
        setAddOpen(true);
    };

    const submitAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: Record<string, unknown> = {
            user_id: parseInt(addForm.user_id, 10),
            workgroup_id: parseInt(addForm.workgroup_id, 10),
            position_name: addForm.position_name.trim(),
            start_date: addForm.start_date,
            start_time: addForm.start_time,
            regulatory: addForm.regulatory,
        };
        if (addForm.desk_type) {
            payload.desk_type = addForm.desk_type;
        } else if (
            deskTypesInWorkgroup.includes('extra') &&
            !positionOptionsFiltered.some((p) => p.label === addForm.position_name.trim())
        ) {
            payload.desk_type = 'extra';
        }
        if (addForm.end_date && addForm.end_time) {
            payload.end_date = addForm.end_date;
            payload.end_time = addForm.end_time;
        }
        router.post('/app/admin/shifts', payload, {
            onSuccess: () => {
                setAddOpen(false);
                setSuccess('Shift added.');
            },
        });
    };

    const submitRotation = (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.user_id || !addForm.workgroup_id || !addForm.position_name.trim() || !rotationForm.date_from || !rotationForm.date_to || !rotationForm.pattern.trim()) return;
        const payload = {
            user_id: parseInt(addForm.user_id, 10),
            workgroup_id: parseInt(addForm.workgroup_id, 10),
            position_name: addForm.position_name.trim(),
            start_time: addForm.start_time,
            regulatory: addForm.regulatory,
            date_from: rotationForm.date_from,
            date_to: rotationForm.date_to,
            pattern: rotationForm.pattern.trim().replace(/\s+/g, ','),
        };
        if (addForm.desk_type) {
            (payload as Record<string, unknown>).desk_type = addForm.desk_type;
        } else if (
            deskTypesInWorkgroup.includes('extra') &&
            !positionOptionsFiltered.some((p) => p.label === addForm.position_name.trim())
        ) {
            (payload as Record<string, unknown>).desk_type = 'extra';
        }
        router.post('/app/admin/shifts/by-rotation', payload, {
            onSuccess: () => {
                setAddOpen(false);
                setSuccess('Shifts added by rotation.');
            },
        });
    };

    const submitDelete = () => {
        if (deleteId == null) return;
        router.delete(`/app/admin/shifts/${deleteId}`, {
            onSuccess: () => {
                setDeleteId(null);
                setSuccess('Shift deleted.');
            },
        });
    };

    const submitBulkDelete = () => {
        if (selectedIds.size === 0) return;
        setBulkDeleteOpen(false);
        router.post('/app/admin/shifts/bulk-destroy', { shift_ids: Array.from(selectedIds) }, {
            onSuccess: () => {
                setSelectedIds(new Set());
                setSuccess('Shifts deleted.');
            },
        });
    };

    const openMove = () => {
        setMoveUserId(allowedUsersForMove[0]?.id?.toString() ?? '');
        setMoveOpen(true);
    };

    const submitBulkMove = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedIds.size === 0 || !moveUserId) return;
        router.post('/app/admin/shifts/bulk-move', {
            shift_ids: Array.from(selectedIds),
            user_id: parseInt(moveUserId, 10),
        }, {
            onSuccess: () => {
                setSelectedIds(new Set());
                setMoveOpen(false);
                setSuccess('Shifts moved.');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Shift Manager - Admin" />
            <div className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Shift Manager</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Add, remove, or move shifts for any user. Use filters then bulk actions for large moves.
                        </p>
                    </div>
                    <Button onClick={openAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add shift
                    </Button>
                </div>

                {success && (
                    <div className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        {success}
                    </div>
                )}

                {/* Filters */}
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-sidebar-border/70 bg-muted/30 p-3 dark:border-sidebar-border">
                    <div className="min-w-[10rem]">
                        <Label className="text-xs">User</Label>
                        <select
                            value={filterUser}
                            onChange={(e) => setFilterUser(e.target.value)}
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                            <option value="">All users</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs">Date from</Label>
                        <Input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            className="mt-1 h-9 w-40"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Date to</Label>
                        <Input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            className="mt-1 h-9 w-40"
                        />
                    </div>
                    <div className="min-w-[10rem]">
                        <Label className="text-xs">Workgroup</Label>
                        <select
                            value={filterWorkgroup}
                            onChange={(e) => setFilterWorkgroup(e.target.value)}
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                            <option value="">All</option>
                            {workgroups.map((wg) => (
                                <option key={wg.id} value={wg.id}>{wg.name}</option>
                            ))}
                        </select>
                    </div>
                    <Button variant="secondary" size="sm" onClick={applyFilters}>Apply</Button>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
                </div>

                {/* Bulk actions */}
                {selectedIds.size > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-sidebar-border/70 bg-card px-3 py-2">
                        <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                        <Button variant="outline" size="sm" onClick={openMove}>
                            <UserPlus className="mr-1 h-4 w-4" />
                            Move to user
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => setBulkDeleteOpen(true)}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete selected
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
                    </div>
                )}

                {/* Table */}
                <div className="mt-4 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-sidebar-border/70 bg-muted/50">
                                    <th className="p-3 w-10">
                                        <Checkbox
                                            checked={shifts.length > 0 && selectedIds.size === shifts.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="p-3 text-left font-medium">User</th>
                                    <th className="p-3 text-left font-medium">Workgroup</th>
                                    <th className="p-3 text-left font-medium">Position</th>
                                    <th className="p-3 text-left font-medium">Desk type</th>
                                    <th className="p-3 text-left font-medium">Start (Central)</th>
                                    <th className="p-3 text-left font-medium">End (Central)</th>
                                    <th className="p-3 text-left font-medium">Reg.</th>
                                    <th className="p-3 text-right font-medium w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shifts.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-4 text-muted-foreground">
                                            No shifts match the filters. Adjust filters or add a shift.
                                        </td>
                                    </tr>
                                ) : (
                                    shifts.map((s) => (
                                        <tr key={s.id} className="border-b border-sidebar-border/50">
                                            <td className="p-3">
                                                <Checkbox
                                                    checked={selectedIds.has(s.id)}
                                                    onCheckedChange={() => toggleSelect(s.id)}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <span className="font-medium">{s.user_name}</span>
                                                <span className="block text-xs text-muted-foreground">{s.user_email}</span>
                                            </td>
                                            <td className="p-3">{s.workgroup_name}</td>
                                            <td className="p-3">{s.position_name}</td>
                                            <td className="p-3">{getDeskTypeLabel(workgroups.find((wg) => wg.id === s.workgroup_id), s.desk_type ?? null)}</td>
                                            <td className="p-3 whitespace-nowrap">{formatDateTimeUtc(s.start_time_utc)}</td>
                                            <td className="p-3 whitespace-nowrap">{formatDateTimeUtc(s.end_time_utc)}</td>
                                            <td className="p-3">{s.regulatory ? 'Yes' : '—'}</td>
                                            <td className="p-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive"
                                                    onClick={() => setDeleteId(s.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add shift modal */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add shift</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitAdd} className="space-y-4">
                        <div>
                            <Label>User</Label>
                            <select
                                value={addForm.user_id}
                                onChange={(e) => {
                                    const uid = e.target.value;
                                    const u = users.find((x) => x.id === parseInt(uid, 10));
                                    const allowedIds = u?.workgroup_ids ?? [];
                                    const currentWgId = parseInt(addForm.workgroup_id, 10);
                                    const keepWorkgroup = addForm.workgroup_id && allowedIds.includes(currentWgId);
                                    setAddForm((f) => ({
                                        ...f,
                                        user_id: uid,
                                        workgroup_id: keepWorkgroup ? f.workgroup_id : (allowedIds.length ? String(allowedIds[0]) : ''),
                                        position_name: keepWorkgroup ? f.position_name : '',
                                        desk_type: keepWorkgroup ? f.desk_type : '',
                                    }));
                                }}
                                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                required
                            >
                                <option value="">Select user</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label>Workgroup</Label>
                            <select
                                value={selectedWorkgroupAllowed ? addForm.workgroup_id : ''}
                                onChange={(e) => setAddForm((f) => ({ ...f, workgroup_id: e.target.value, position_name: '', desk_type: '' }))}
                                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                required
                            >
                                <option value="">Select workgroup</option>
                                {allowedWorkgroupsForUser.map((wg) => (
                                    <option key={wg.id} value={wg.id}>{wg.name}</option>
                                ))}
                            </select>
                            {selectedUser && allowedWorkgroupsForUser.length === 0 && (
                                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">This user has no workgroups. Assign workgroups in User Manager first.</p>
                            )}
                        </div>
                        <div>
                            <Label>Desk type (filter)</Label>
                            <select
                                value={deskTypesInWorkgroup.includes(addForm.desk_type) ? addForm.desk_type : ''}
                                onChange={(e) => setAddForm((f) => ({ ...f, desk_type: e.target.value, position_name: '' }))}
                                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                            >
                                <option value="">All desks</option>
                                {deskTypesInWorkgroup.map((dt) => (
                                    <option key={dt} value={dt}>{getDeskTypeLabel(selectedWorkgroup ?? undefined, dt)}</option>
                                ))}
                            </select>
                            <p className="mt-0.5 text-xs text-muted-foreground">Optional: limits which positions appear below (only types in this workgroup)</p>
                        </div>
                        <div>
                            <Label>Position / desk</Label>
                            {positionOptionsFiltered.length > 0 ? (
                                <select
                                    value={addForm.position_name}
                                    onChange={(e) => {
                                        const p = positionOptionsFiltered.find((x) => x.label === e.target.value);
                                        setAddForm((f) => ({
                                            ...f,
                                            position_name: e.target.value,
                                            desk_type: (p as { shift_type?: string })?.shift_type ?? f.desk_type,
                                        }));
                                    }}
                                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                    required
                                >
                                    <option value="">Select or type below</option>
                                    {positionOptionsFiltered.map((p) => (
                                        <option key={p.label} value={p.label}>
                                            {p.label}
                                            {p.shift_type ? ` (${getDeskTypeLabel(selectedWorkgroup ?? undefined, p.shift_type)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : null}
                            <Input
                                placeholder="Position name (e.g. Desk 1, G2)"
                                value={addForm.position_name}
                                onChange={(e) => setAddForm((f) => ({ ...f, position_name: e.target.value }))}
                                className="mt-1"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Start date</Label>
                                <Input
                                    type="date"
                                    value={addForm.start_date}
                                    onChange={(e) => setAddForm((f) => ({ ...f, start_date: e.target.value }))}
                                    className="mt-1"
                                    required
                                />
                            </div>
                            <div>
                                <Label>Start time</Label>
                                {selectedWorkgroup?.allowed_start_times?.length ? (
                                    <select
                                        value={addForm.start_time}
                                        onChange={(e) => setAddForm((f) => ({ ...f, start_time: e.target.value }))}
                                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                    >
                                        {selectedWorkgroup.allowed_start_times.map((t) => (
                                            <option key={t.start_time} value={t.start_time}>{t.start_time}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <Input
                                        type="time"
                                        value={addForm.start_time}
                                        onChange={(e) => setAddForm((f) => ({ ...f, start_time: e.target.value }))}
                                        className="mt-1"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>End date (optional)</Label>
                                <Input
                                    type="date"
                                    value={addForm.end_date}
                                    onChange={(e) => setAddForm((f) => ({ ...f, end_date: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>End time (optional)</Label>
                                <Input
                                    type="time"
                                    value={addForm.end_time}
                                    onChange={(e) => setAddForm((f) => ({ ...f, end_time: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="add-regulatory"
                                checked={addForm.regulatory}
                                onCheckedChange={(v) => setAddForm((f) => ({ ...f, regulatory: v === true }))}
                            />
                            <Label htmlFor="add-regulatory" className="text-sm font-normal">Regulatory</Label>
                        </div>

                        <div className="border-t border-border pt-4">
                            <p className="text-xs font-medium text-muted-foreground">Add by rotation (testing)</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Fill user, workgroup, position, and start time above. Then set a date range and pattern (e.g. 5, 3, 5, 5 = work 5 days, off 3, work 5, off 5). First day in range starts the first work block.
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Date from</Label>
                                    <Input
                                        type="date"
                                        value={rotationForm.date_from}
                                        onChange={(e) => setRotationForm((f) => ({ ...f, date_from: e.target.value }))}
                                        className="mt-0.5 h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Date to</Label>
                                    <Input
                                        type="date"
                                        value={rotationForm.date_to}
                                        onChange={(e) => setRotationForm((f) => ({ ...f, date_to: e.target.value }))}
                                        className="mt-0.5 h-8 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="mt-2">
                                <Label className="text-xs">Pattern (work, off, work, off…)</Label>
                                <Input
                                    placeholder="5, 3, 5, 5"
                                    value={rotationForm.pattern}
                                    onChange={(e) => setRotationForm((f) => ({ ...f, pattern: e.target.value }))}
                                    className="mt-0.5 h-8 text-sm"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="mt-2"
                                onClick={submitRotation}
                                disabled={!addForm.user_id || !addForm.workgroup_id || !addForm.position_name.trim() || !rotationForm.date_from || !rotationForm.date_to || !rotationForm.pattern.trim()}
                            >
                                Add shifts by rotation
                            </Button>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                            <Button type="submit">Add shift</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Move to user modal */}
            <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Move {selectedIds.size} shift(s) to user</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitBulkMove} className="space-y-4">
                        <div>
                            <Label>User</Label>
                            <select
                                value={allowedUsersForMove.some((u) => u.id === parseInt(moveUserId, 10)) ? moveUserId : ''}
                                onChange={(e) => setMoveUserId(e.target.value)}
                                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                required
                            >
                                <option value="">Select user</option>
                                {allowedUsersForMove.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                ))}
                            </select>
                            {allowedUsersForMove.length === 0 && selectedIds.size > 0 && (
                                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">No user belongs to all workgroups of the selected shifts. Move shifts in smaller batches by workgroup.</p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
                            <Button type="submit">Move shifts</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete single confirm */}
            <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete this shift?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently remove the shift. Any open postings for this shift will be removed.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={submitDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk delete confirm */}
            <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {selectedIds.size} shift(s)?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently remove the selected shifts. Any open postings for these shifts will be removed.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={submitBulkDelete}>Delete all</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
