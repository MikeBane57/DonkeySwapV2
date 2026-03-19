import { Head, router, usePage } from '@inertiajs/react';
import { Plus, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Workgroup Manager', href: '/app/admin/workgroups' },
];

type AllowedStartTime = { id: number; start_time: string; default_duration_minutes: number };
type DeskType = { id?: number; code: string; label: string; is_regulatory?: boolean; workgroup_qualification_code?: string };
type PositionRange = { id?: number; range_spec: string; parity: string; desk_type_code: string };
type WorkgroupQualification = { id?: number; code: string; label: string };
type Workgroup = {
    id: number;
    name: string;
    max_hours_per_day: number | null;
    rest_required_hours: number | null;
    allow_double: boolean;
    allowed_start_times: AllowedStartTime[];
    desk_types: DeskType[];
    position_ranges: PositionRange[];
    qualifications: WorkgroupQualification[];
};

const emptyStartTime = (): { start_time: string; default_duration_minutes: number } => ({
    start_time: '06:00',
    default_duration_minutes: 510,
});
const emptyPositionRange = (): { range_spec: string; parity: string; desk_type_code: string } => ({
    range_spec: '',
    parity: '',
    desk_type_code: 'extra',
});
const emptyDeskType = (): { code: string; label: string; workgroup_qualification_code: string } => ({
    code: '',
    label: '',
    workgroup_qualification_code: '',
});
const emptyQualification = (): { code: string; label: string } => ({ code: '', label: '' });

/** e.g. 510 -> "8h 30m", 480 -> "8h" */
function formatDurationMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

const DESK_TYPE_CODE_LABELS: Record<string, string> = {
    domestic_dispatch: 'Domestic',
    assistant_desk: 'Assistant',
    etops: 'ETOPS',
    intl: 'INTL',
    regional: 'Regional',
    sector: 'Sector',
    nextday: 'NextDay',
    extra: 'Extra',
};

function formatPositionRange(r: PositionRange, deskTypes?: DeskType[]): string {
    const label =
        deskTypes?.find((d) => d.code === r.desk_type_code)?.label ?? DESK_TYPE_CODE_LABELS[r.desk_type_code] ?? r.desk_type_code;
    if (r.parity) return `${r.range_spec} (${r.parity}) → ${label}`;
    return `${r.range_spec} → ${label}`;
}

type EditSection = 'basics' | 'start_times' | 'desk_types' | 'position_ranges' | 'qualifications';

export default function AdminWorkgroups() {
    const { workgroups = [], flash } = usePage().props as {
        workgroups: Workgroup[];
        flash?: { success?: string; error?: string };
    };
    const [success, setSuccess] = useState(flash?.success ?? null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Workgroup | null>(null);
    const [editSection, setEditSection] = useState<EditSection | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const [form, setForm] = useState({
        name: '',
        max_hours_per_day: 10,
        rest_required_hours: 8,
        allow_double: false,
        allowed_start_times: [emptyStartTime()],
        desk_types: [] as { code: string; label: string; is_regulatory: boolean; workgroup_qualification_code: string }[],
        position_ranges: [] as { range_spec: string; parity: string; desk_type_code: string }[],
        qualifications: [] as { code: string; label: string }[],
    });

    const openCreate = () => {
        setForm({
            name: '',
            max_hours_per_day: 10,
            rest_required_hours: 8,
            allow_double: false,
            allowed_start_times: [emptyStartTime()],
            desk_types: [],
            position_ranges: [],
            qualifications: [],
        });
        setCreateOpen(true);
    };

    const openEdit = (wg: Workgroup) => {
        setEditing(wg);
        setEditSection(null);
        setForm({
            name: wg.name,
            regulatory: wg.regulatory,
            max_hours_per_day: wg.max_hours_per_day ?? 10,
            rest_required_hours: wg.rest_required_hours ?? 8,
            allow_double: wg.allow_double,
            allowed_start_times:
                wg.allowed_start_times.length > 0
                    ? wg.allowed_start_times.map((t) => ({
                          start_time: t.start_time,
                          default_duration_minutes: t.default_duration_minutes,
                      }))
                    : [emptyStartTime()],
            desk_types: (wg.desk_types ?? []).length > 0
                ? wg.desk_types.map((d) => ({
                      code: d.code,
                      label: d.label,
                      workgroup_qualification_code: d.workgroup_qualification_code ?? '',
                  }))
                : [],
            position_ranges: (wg.position_ranges ?? []).length > 0
                ? wg.position_ranges.map((r) => ({
                      range_spec: r.range_spec,
                      parity: r.parity ?? '',
                      desk_type_code: r.desk_type_code ?? 'extra',
                  }))
                : [],
            qualifications: (wg.qualifications ?? []).length > 0
                ? wg.qualifications.map((q) => ({ code: q.code, label: q.label }))
                : [],
        });
    };

    const openEditSection = (wg: Workgroup, section: EditSection) => {
        setEditing(wg);
        setEditSection(section);
        setForm({
            name: wg.name,
            max_hours_per_day: wg.max_hours_per_day ?? 10,
            rest_required_hours: wg.rest_required_hours ?? 8,
            allow_double: wg.allow_double,
            allowed_start_times:
                wg.allowed_start_times.length > 0
                    ? wg.allowed_start_times.map((t) => ({
                          start_time: t.start_time,
                          default_duration_minutes: t.default_duration_minutes,
                      }))
                    : [emptyStartTime()],
            desk_types: (wg.desk_types ?? []).length > 0
                ? wg.desk_types.map((d) => ({
                      code: d.code,
                      label: d.label,
                      is_regulatory: d.is_regulatory ?? false,
                      workgroup_qualification_code: d.workgroup_qualification_code ?? '',
                  }))
                : [],
            position_ranges: (wg.position_ranges ?? []).length > 0
                ? wg.position_ranges.map((r) => ({
                      range_spec: r.range_spec,
                      parity: r.parity ?? '',
                      desk_type_code: r.desk_type_code ?? 'extra',
                  }))
                : [],
            qualifications: (wg.qualifications ?? []).length > 0
                ? wg.qualifications.map((q) => ({ code: q.code, label: q.label }))
                : [],
        });
    };

    const closeSectionEdit = () => {
        setEditing(null);
        setEditSection(null);
    };

    const submitSectionUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing || !editSection) return;
        const payload = {
            ...form,
            desk_types: form.desk_types.filter((d) => d.code.trim() !== '' && d.label.trim() !== ''),
            position_ranges: form.position_ranges.filter((r) => r.range_spec.trim() !== ''),
            qualifications: form.qualifications.filter((q) => q.code.trim() !== '' && q.label.trim() !== ''),
        };
        router.put(`/app/admin/workgroups/${editing.id}`, payload, {
            onSuccess: () => {
                closeSectionEdit();
                setSuccess('Workgroup updated.');
            },
        });
    };

    const addStartTime = () => {
        setForm((f) => ({
            ...f,
            allowed_start_times: [...f.allowed_start_times, emptyStartTime()],
        }));
    };

    const removeStartTime = (index: number) => {
        setForm((f) => ({
            ...f,
            allowed_start_times: f.allowed_start_times.filter((_, i) => i !== index),
        }));
    };

    const updateStartTime = (index: number, field: 'start_time' | 'default_duration_minutes', value: string | number) => {
        setForm((f) => ({
            ...f,
            allowed_start_times: f.allowed_start_times.map((t, i) =>
                i === index ? { ...t, [field]: value } : t
            ),
        }));
    };

    const addPositionRange = () => {
        setForm((f) => ({ ...f, position_ranges: [...f.position_ranges, emptyPositionRange()] }));
    };
    const removePositionRange = (index: number) => {
        setForm((f) => ({ ...f, position_ranges: f.position_ranges.filter((_, i) => i !== index) }));
    };
    const updatePositionRange = (index: number, field: 'range_spec' | 'parity' | 'desk_type_code', value: string) => {
        setForm((f) => ({
            ...f,
            position_ranges: f.position_ranges.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
        }));
    };
    const addDeskType = () => {
        setForm((f) => ({ ...f, desk_types: [...f.desk_types, emptyDeskType()] }));
    };
    const removeDeskType = (index: number) => {
        setForm((f) => ({ ...f, desk_types: f.desk_types.filter((_, i) => i !== index) }));
    };
    const updateDeskType = (index: number, field: 'code' | 'label' | 'workgroup_qualification_code' | 'is_regulatory', value: string | boolean) => {
        setForm((f) => ({
            ...f,
            desk_types: f.desk_types.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
        }));
    };

    const deskTypeOptions = (): { value: string; label: string }[] => {
        if (form.desk_types.length === 0) return [{ value: '', label: '(Add desk types first)' }];
        return form.desk_types.filter((d) => d.code.trim() !== '').map((d) => ({ value: d.code, label: d.label || d.code }));
    };

    const addQualification = () => {
        setForm((f) => ({ ...f, qualifications: [...f.qualifications, emptyQualification()] }));
    };
    const removeQualification = (index: number) => {
        setForm((f) => ({ ...f, qualifications: f.qualifications.filter((_, i) => i !== index) }));
    };
    const updateQualification = (index: number, field: 'code' | 'label', value: string) => {
        setForm((f) => ({
            ...f,
            qualifications: f.qualifications.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
        }));
    };

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...form,
            desk_types: form.desk_types.filter((d) => d.code.trim() !== '' && d.label.trim() !== ''),
            position_ranges: form.position_ranges.filter((r) => r.range_spec.trim() !== ''),
            qualifications: form.qualifications.filter((q) => q.code.trim() !== '' && q.label.trim() !== ''),
        };
        router.post('/app/admin/workgroups', payload, {
            onSuccess: () => {
                setCreateOpen(false);
                setSuccess('Workgroup created.');
            },
        });
    };

    const submitUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        const payload = {
            ...form,
            desk_types: form.desk_types.filter((d) => d.code.trim() !== '' && d.label.trim() !== ''),
            position_ranges: form.position_ranges.filter((r) => r.range_spec.trim() !== ''),
            qualifications: form.qualifications.filter((q) => q.code.trim() !== '' && q.label.trim() !== ''),
        };
        router.put(`/app/admin/workgroups/${editing.id}`, payload, {
            onSuccess: () => {
                setEditing(null);
                setSuccess('Workgroup updated.');
            },
        });
    };

    const submitDelete = () => {
        if (deleteId == null) return;
        router.delete(`/app/admin/workgroups/${deleteId}`, {
            onSuccess: () => {
                setDeleteId(null);
                setSuccess('Workgroup deleted.');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Workgroup Manager - Admin" />
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Workgroup Manager</h1>
                        <p className="mt-2 text-muted-foreground text-sm">
                            Create workgroups, set max hours, rest hours, allowed start times, and desk types (regulatory per desk type).
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add workgroup
                    </Button>
                </div>
                {success && (
                    <div className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        {success}
                    </div>
                )}
                <div className="mt-4 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-sidebar-border/70 bg-muted/50">
                                    <th className="p-3 text-left font-medium">Name</th>
                                    <th className="p-3 text-left font-medium">Max hrs/day</th>
                                    <th className="p-3 text-left font-medium">Rest hrs</th>
                                    <th className="p-3 text-left font-medium">Double</th>
                                    <th className="p-3 text-left font-medium">
                                        Allowed start times
                                        <span className="ml-1 font-normal text-muted-foreground">(time = duration)</span>
                                    </th>
                                    <th className="p-3 text-left font-medium min-w-[10rem]">Desk types</th>
                                    <th className="p-3 text-left font-medium min-w-[12rem]">Position ranges</th>
                                    <th className="p-3 text-left font-medium min-w-[10rem]">Qualifications</th>
                                    <th className="p-3 text-right font-medium w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workgroups.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="p-4 text-muted-foreground">
                                            No workgroups yet. Click “Add workgroup” to create one.
                                        </td>
                                    </tr>
                                )}
                                {workgroups.map((wg) => (
                                    <tr key={wg.id} className="border-b border-sidebar-border/50 align-top">
                                        <td className="p-3">
                                            <div className="flex items-center gap-1">
                                                <span className="font-medium">{wg.name}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEditSection(wg, 'basics')}
                                                    title="Edit name & basics"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="p-3">{wg.max_hours_per_day ?? '—'}</td>
                                        <td className="p-3">{wg.rest_required_hours ?? '—'}</td>
                                        <td className="p-3">{wg.allow_double ? 'Yes' : 'No'}</td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap items-center gap-1">
                                                {wg.allowed_start_times.length === 0 ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    wg.allowed_start_times.map((t) => (
                                                        <span
                                                            key={t.id}
                                                            className="inline-block rounded bg-muted px-1.5 py-0.5"
                                                        >
                                                            {t.start_time}
                                                            {t.default_duration_minutes
                                                                ? ` (${formatDurationMinutes(t.default_duration_minutes)})`
                                                                : ''}
                                                        </span>
                                                    ))
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEditSection(wg, 'start_times')}
                                                    title="Edit start times"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap items-center gap-1">
                                                {(wg.desk_types ?? []).length === 0 ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    (wg.desk_types ?? []).map((d) => (
                                                        <span
                                                            key={d.id ?? d.code}
                                                            className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs"
                                                        >
                                                            {d.label}
                                                            {d.is_regulatory ? ' (Reg)' : ''}
                                                            {d.workgroup_qualification_code ? ` (${d.workgroup_qualification_code})` : ''}
                                                        </span>
                                                    ))
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEditSection(wg, 'desk_types')}
                                                    title="Edit desk types"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap items-center gap-1">
                                                {(wg.position_ranges ?? []).length === 0 ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    (wg.position_ranges ?? []).map((r, i) => (
                                                        <span
                                                            key={r.id ?? i}
                                                            className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs"
                                                        >
                                                            {formatPositionRange(r, wg.desk_types)}
                                                        </span>
                                                    ))
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEditSection(wg, 'position_ranges')}
                                                    title="Edit position ranges"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap items-center gap-1">
                                                {(wg.qualifications ?? []).length === 0 ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    (wg.qualifications ?? []).map((q) => (
                                                        <span
                                                            key={q.id}
                                                            className="inline-block rounded bg-muted px-1.5 py-0.5"
                                                        >
                                                            {q.code}
                                                            {q.label && q.label !== q.code ? ` (${q.label})` : ''}
                                                        </span>
                                                    ))
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEditSection(wg, 'qualifications')}
                                                    title="Edit qualifications"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" title="Edit workgroup">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEdit(wg)}>
                                                        Full edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEditSection(wg, 'basics')}>
                                                        Edit basics
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEditSection(wg, 'start_times')}>
                                                        Edit start times
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEditSection(wg, 'desk_types')}>
                                                        Edit desk types
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEditSection(wg, 'position_ranges')}>
                                                        Edit position ranges
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEditSection(wg, 'qualifications')}>
                                                        Edit qualifications
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => setDeleteId(wg.id)}
                                                title="Delete workgroup"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden p-0 gap-0">
                    <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                        <DialogTitle>Add workgroup</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitCreate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-2 space-y-4">
                            <div>
                                <Label htmlFor="create-name">Name</Label>
                                <Input
                                    id="create-name"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    required
                                    className="mt-1"
                                />
                            </div>
                                            <div className="flex items-center gap-4">
                                <Label className="flex items-center gap-2">
                                    <Checkbox
                                        checked={form.allow_double}
                                        onCheckedChange={(v) => setForm((f) => ({ ...f, allow_double: v === true }))}
                                    />
                                    Allow double
                                </Label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="create-max-hrs">Max hours/day</Label>
                                    <Input
                                        id="create-max-hrs"
                                        type="number"
                                        min={1}
                                        max={24}
                                        value={form.max_hours_per_day}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, max_hours_per_day: parseInt(e.target.value, 10) || 10 }))
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="create-rest">Rest required (hours)</Label>
                                    <Input
                                        id="create-rest"
                                        type="number"
                                        min={0}
                                        max={24}
                                        value={form.rest_required_hours}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                rest_required_hours: parseInt(e.target.value, 10) || 8,
                                            }))
                                        }
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label>Allowed start times</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addStartTime}>
                                        Add time
                                    </Button>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {form.allowed_start_times.map((t, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input
                                                type="time"
                                                value={t.start_time}
                                                onChange={(e) => updateStartTime(i, 'start_time', e.target.value)}
                                                className="w-28"
                                            />
                                            <Input
                                                type="number"
                                                min={1}
                                                max={1440}
                                                placeholder="Min"
                                                value={t.default_duration_minutes}
                                                onChange={(e) =>
                                                    updateStartTime(
                                                        i,
                                                        'default_duration_minutes',
                                                        parseInt(e.target.value, 10) || 510
                                                    )
                                                }
                                                className="w-28"
                                            />
                                            <span className="text-muted-foreground text-xs tabular-nums">
                                                = {formatDurationMinutes(t.default_duration_minutes)}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeStartTime(i)}
                                                disabled={form.allowed_start_times.length <= 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label>Desk types</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addDeskType}>
                                        Add desk type
                                    </Button>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Define desk types for this workgroup (e.g. Domestic dispatch, Assistant desk, Regional). Optionally require a qualification to work each type.
                                </p>
                                <div className="mt-2 space-y-2">
                                    {form.desk_types.map((d, i) => (
                                        <div key={i} className="flex flex-wrap gap-2 items-center">
                                            <Input
                                                placeholder="Code (e.g. domestic_dispatch)"
                                                value={d.code}
                                                onChange={(e) => updateDeskType(i, 'code', e.target.value)}
                                                className="w-40"
                                            />
                                            <Input
                                                placeholder="Label (e.g. Domestic dispatch)"
                                                value={d.label}
                                                onChange={(e) => updateDeskType(i, 'label', e.target.value)}
                                                className="w-40"
                                            />
                                            <select
                                                value={d.workgroup_qualification_code}
                                                onChange={(e) => updateDeskType(i, 'workgroup_qualification_code', e.target.value)}
                                                className="flex h-9 min-w-[8rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                            >
                                                <option value="">No qualification</option>
                                                {form.qualifications.filter((q) => q.code.trim() !== '').map((q) => (
                                                    <option key={q.code} value={q.code}>
                                                        {q.code}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeDeskType(i)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label>Position ranges</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addPositionRange}>
                                        Add range
                                    </Button>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Range: e.g. 1-98, G1-G4. Assign each range to a desk type above.
                                </p>
                                <div className="mt-2 space-y-2">
                                    {form.position_ranges.map((r, i) => (
                                        <div key={i} className="flex flex-wrap gap-2 items-center">
                                            <Input
                                                placeholder="Range (e.g. 1-98, A, G1-G4)"
                                                value={r.range_spec}
                                                onChange={(e) => updatePositionRange(i, 'range_spec', e.target.value)}
                                                className="w-40"
                                            />
                                            <select
                                                value={r.parity}
                                                onChange={(e) => updatePositionRange(i, 'parity', e.target.value)}
                                                className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                            >
                                                <option value="">—</option>
                                                <option value="even">Even</option>
                                                <option value="odd">Odd</option>
                                            </select>
                                            <select
                                                value={r.desk_type_code}
                                                onChange={(e) => updatePositionRange(i, 'desk_type_code', e.target.value)}
                                                className="flex h-9 min-w-[10rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                            >
                                                {deskTypeOptions().map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removePositionRange(i)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label>Qualifications (dispatcher / worker)</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addQualification}>
                                        Add qualification
                                    </Button>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    e.g. Dispatch: ETOPS, INTL, ASST. Users can be assigned these per workgroup. Default new users: Dispatch + ASST.
                                </p>
                                <div className="mt-2 space-y-2">
                                    {form.qualifications.map((q, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input
                                                placeholder="Code"
                                                value={q.code}
                                                onChange={(e) => updateQualification(i, 'code', e.target.value)}
                                                className="w-24"
                                            />
                                            <Input
                                                placeholder="Label"
                                                value={q.label}
                                                onChange={(e) => updateQualification(i, 'label', e.target.value)}
                                                className="w-32"
                                            />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQualification(i)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="px-6 py-4 border-t shrink-0">
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Create</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden p-0 gap-0">
                    <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                        <DialogTitle>Edit workgroup</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitUpdate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-2 space-y-4">
                            <div>
                                <Label htmlFor="edit-name">Name</Label>
                                <Input
                                    id="edit-name"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    required
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <Label className="flex items-center gap-2">
                                    <Checkbox
                                        checked={form.allow_double}
                                        onCheckedChange={(v) => setForm((f) => ({ ...f, allow_double: v === true }))}
                                    />
                                    Allow double
                                </Label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Max hours/day</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={24}
                                        value={form.max_hours_per_day}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, max_hours_per_day: parseInt(e.target.value, 10) || 10 }))
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Rest required (hours)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={24}
                                        value={form.rest_required_hours}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                rest_required_hours: parseInt(e.target.value, 10) || 8,
                                            }))
                                        }
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label>Allowed start times</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addStartTime}>
                                        Add time
                                    </Button>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {form.allowed_start_times.map((t, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input
                                                type="time"
                                                value={t.start_time}
                                                onChange={(e) => updateStartTime(i, 'start_time', e.target.value)}
                                                className="w-28"
                                            />
                                            <Input
                                                type="number"
                                                min={1}
                                                max={1440}
                                                value={t.default_duration_minutes}
                                                onChange={(e) =>
                                                    updateStartTime(
                                                        i,
                                                        'default_duration_minutes',
                                                        parseInt(e.target.value, 10) || 510
                                                    )
                                                }
                                                className="w-28"
                                            />
                                            <span className="text-muted-foreground text-xs tabular-nums">
                                                = {formatDurationMinutes(t.default_duration_minutes)}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeStartTime(i)}
                                                disabled={form.allowed_start_times.length <= 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label>Position ranges</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addPositionRange}>
                                        Add range
                                    </Button>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Range: e.g. 1-98, G1-G4. Assign each range to a desk type.
                                </p>
                                <div className="mt-2 space-y-2">
                                    {form.position_ranges.map((r, i) => (
                                        <div key={i} className="flex flex-wrap gap-2 items-center">
                                            <Input
                                                placeholder="Range (e.g. 1-98, A, G1-G4)"
                                                value={r.range_spec}
                                                onChange={(e) => updatePositionRange(i, 'range_spec', e.target.value)}
                                                className="w-40"
                                            />
                                            <select
                                                value={r.parity}
                                                onChange={(e) => updatePositionRange(i, 'parity', e.target.value)}
                                                className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                            >
                                                <option value="">—</option>
                                                <option value="even">Even</option>
                                                <option value="odd">Odd</option>
                                            </select>
                                            <select
                                                value={r.desk_type_code}
                                                onChange={(e) => updatePositionRange(i, 'desk_type_code', e.target.value)}
                                                className="flex h-9 min-w-[10rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                            >
                                                {deskTypeOptions().map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removePositionRange(i)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label>Qualifications</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addQualification}>
                                        Add qualification
                                    </Button>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {form.qualifications.map((q, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input
                                                placeholder="Code"
                                                value={q.code}
                                                onChange={(e) => updateQualification(i, 'code', e.target.value)}
                                                className="w-24"
                                            />
                                            <Input
                                                placeholder="Label"
                                                value={q.label}
                                                onChange={(e) => updateQualification(i, 'label', e.target.value)}
                                                className="w-32"
                                            />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQualification(i)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="px-6 py-4 border-t shrink-0">
                            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Section edit dialog (basics / start times / position ranges / qualifications) */}
            <Dialog open={!!editSection && !!editing} onOpenChange={(open) => !open && closeSectionEdit()}>
                <DialogContent className="max-h-[90vh] max-w-xl flex flex-col overflow-hidden p-0 gap-0">
                    <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                        <DialogTitle>
                            {editing?.name} —{' '}
                            {editSection === 'basics' && 'Edit basics'}
                            {editSection === 'start_times' && 'Edit start times'}
                            {editSection === 'desk_types' && 'Edit desk types'}
                            {editSection === 'position_ranges' && 'Edit position ranges'}
                            {editSection === 'qualifications' && 'Edit qualifications'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitSectionUpdate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-2 space-y-4">
                            {editSection === 'basics' && (
                                <>
                                    <div>
                                        <Label htmlFor="section-name">Name</Label>
                                        <Input
                                            id="section-name"
                                            value={form.name}
                                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                            required
                                            className="mt-1"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Label className="flex items-center gap-2">
                                            <Checkbox
                                                checked={form.allow_double}
                                                onCheckedChange={(v) => setForm((f) => ({ ...f, allow_double: v === true }))}
                                            />
                                            Allow double
                                        </Label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Max hours/day</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={24}
                                                value={form.max_hours_per_day}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, max_hours_per_day: parseInt(e.target.value, 10) || 10 }))
                                                }
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label>Rest required (hours)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={24}
                                                value={form.rest_required_hours}
                                                onChange={(e) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        rest_required_hours: parseInt(e.target.value, 10) || 8,
                                                    }))
                                                }
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            {editSection === 'start_times' && (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label>Allowed start times</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addStartTime}>
                                            Add time
                                        </Button>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        {form.allowed_start_times.map((t, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <Input
                                                    type="time"
                                                    value={t.start_time}
                                                    onChange={(e) => updateStartTime(i, 'start_time', e.target.value)}
                                                    className="w-28"
                                                />
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={1440}
                                                    value={t.default_duration_minutes}
                                                    onChange={(e) =>
                                                        updateStartTime(
                                                            i,
                                                            'default_duration_minutes',
                                                            parseInt(e.target.value, 10) || 510
                                                        )
                                                    }
                                                    className="w-28"
                                                />
                                                <span className="text-muted-foreground text-xs tabular-nums">
                                                    = {formatDurationMinutes(t.default_duration_minutes)}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeStartTime(i)}
                                                    disabled={form.allowed_start_times.length <= 1}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {editSection === 'desk_types' && (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label>Desk types</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addDeskType}>
                                            Add desk type
                                        </Button>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Code (e.g. domestic_dispatch), label, regulatory flag, and optional required qualification.
                                    </p>
                                    <div className="mt-2 space-y-2">
                                        {form.desk_types.map((d, i) => (
                                            <div key={i} className="flex flex-wrap gap-2 items-center">
                                                <Input
                                                    placeholder="Code"
                                                    value={d.code}
                                                    onChange={(e) => updateDeskType(i, 'code', e.target.value)}
                                                    className="w-36"
                                                />
                                                <Input
                                                    placeholder="Label"
                                                    value={d.label}
                                                    onChange={(e) => updateDeskType(i, 'label', e.target.value)}
                                                    className="w-36"
                                                />
                                                <Label className="flex items-center gap-1.5 text-xs">
                                                    <Checkbox
                                                        checked={d.is_regulatory}
                                                        onCheckedChange={(v) => updateDeskType(i, 'is_regulatory', v === true)}
                                                    />
                                                    Reg
                                                </Label>
                                                <select
                                                    value={d.workgroup_qualification_code}
                                                    onChange={(e) => updateDeskType(i, 'workgroup_qualification_code', e.target.value)}
                                                    className="flex h-9 min-w-[7rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                                >
                                                    <option value="">No qual.</option>
                                                    {form.qualifications.filter((q) => q.code.trim() !== '').map((q) => (
                                                        <option key={q.code} value={q.code}>{q.code}</option>
                                                    ))}
                                                </select>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeDeskType(i)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {editSection === 'position_ranges' && (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label>Position ranges</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addPositionRange}>
                                            Add range
                                        </Button>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Range: e.g. 1-98, G1-G4. Assign each to a desk type.
                                    </p>
                                    <div className="mt-2 space-y-2">
                                        {form.position_ranges.map((r, i) => (
                                            <div key={i} className="flex flex-wrap gap-2 items-center">
                                                <Input
                                                    placeholder="Range"
                                                    value={r.range_spec}
                                                    onChange={(e) => updatePositionRange(i, 'range_spec', e.target.value)}
                                                    className="w-40"
                                                />
                                                <select
                                                    value={r.parity}
                                                    onChange={(e) => updatePositionRange(i, 'parity', e.target.value)}
                                                    className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                                >
                                                    <option value="">—</option>
                                                    <option value="even">Even</option>
                                                    <option value="odd">Odd</option>
                                                </select>
                                                <select
                                                    value={r.desk_type_code}
                                                    onChange={(e) => updatePositionRange(i, 'desk_type_code', e.target.value)}
                                                    className="flex h-9 min-w-[10rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                                >
                                                    {deskTypeOptions().map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removePositionRange(i)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {editSection === 'qualifications' && (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label>Qualifications</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addQualification}>
                                            Add qualification
                                        </Button>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        {form.qualifications.map((q, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <Input
                                                    placeholder="Code"
                                                    value={q.code}
                                                    onChange={(e) => updateQualification(i, 'code', e.target.value)}
                                                    className="w-24"
                                                />
                                                <Input
                                                    placeholder="Label"
                                                    value={q.label}
                                                    onChange={(e) => updateQualification(i, 'label', e.target.value)}
                                                    className="w-32"
                                                />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeQualification(i)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter className="px-6 py-4 border-t shrink-0">
                            <Button type="button" variant="outline" onClick={closeSectionEdit}>
                                Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete workgroup?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will remove the workgroup and its allowed start times. Users assigned to this
                        workgroup will be unassigned. This cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={submitDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
