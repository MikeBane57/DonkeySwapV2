import { Head, router, usePage } from '@inertiajs/react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'Red Line Editor', href: '/app/admin/red-lines' },
];

type UserSummary = { id: number; name: string; email: string };
type UserAboveLine = UserSummary & { seniority_number: number | null };
type RedLine = {
    id: number;
    workgroup_id: number;
    workgroup_name: string | null;
    red_line_position: number;
    users_above: UserAboveLine[];
    users_below: UserSummary[];
};
type WorkgroupOption = { id: number; name: string };

export default function AdminRedLines() {
    const { redLines = [], workgroups = [], flash } = usePage().props as {
        redLines: RedLine[];
        workgroups: WorkgroupOption[];
        flash?: { success?: string; error?: string };
    };
    const [success, setSuccess] = useState(flash?.success ?? null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<RedLine | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [createForm, setCreateForm] = useState({ workgroup_id: '', red_line_position: 0 });
    const [editPosition, setEditPosition] = useState(0);
    const [aboveLineSeniority, setAboveLineSeniority] = useState<{ user_id: number; seniority_number: number | null }[]>([]);

    const openEdit = (rl: RedLine) => {
        setEditing(rl);
        setEditPosition(rl.red_line_position);
        setAboveLineSeniority(
            rl.users_above.map((u) => ({
                user_id: u.id,
                seniority_number: u.seniority_number ?? null,
            }))
        );
    };

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const wgId = createForm.workgroup_id ? parseInt(createForm.workgroup_id, 10) : null;
        if (!wgId) return;
        router.post('/app/admin/red-lines', {
            workgroup_id: wgId,
            red_line_position: createForm.red_line_position,
        }, {
            onSuccess: () => {
                setCreateOpen(false);
                setCreateForm({ workgroup_id: workgroups[0]?.id.toString() ?? '', red_line_position: 0 });
                setSuccess('Red line created.');
            },
        });
    };

    const setSeniorityForUser = (userId: number, value: number | null) => {
        setAboveLineSeniority((prev) =>
            prev.map((u) => (u.user_id === userId ? { ...u, seniority_number: value } : u))
        );
    };

    const submitUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        router.put(`/app/admin/red-lines/${editing.id}`, {
            red_line_position: editPosition,
            above_line_seniority: aboveLineSeniority.map((u) => ({
                user_id: u.user_id,
                seniority_number: u.seniority_number ?? null,
            })),
        }, {
            onSuccess: () => {
                setEditing(null);
                setSuccess('Red line updated.');
            },
        });
    };

    const submitDelete = () => {
        if (deleteId == null) return;
        router.delete(`/app/admin/red-lines/${deleteId}`, {
            onSuccess: () => {
                setDeleteId(null);
                setSuccess('Red line deleted.');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Red Line Editor - Admin" />
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Red Line Editor</h1>
                        <p className="mt-2 text-muted-foreground text-sm">
                            Set red line position per workgroup. Users are ordered by classification seniority (oldest first = above line).
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            setCreateForm({
                                workgroup_id: workgroups[0]?.id.toString() ?? '',
                                red_line_position: 0,
                            });
                            setCreateOpen(true);
                        }}
                        disabled={workgroups.length === 0}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add red line
                    </Button>
                </div>
                {success && (
                    <div className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        {success}
                    </div>
                )}
                <div className="mt-4 space-y-6">
                    {redLines.length === 0 && !createOpen && (
                        <div className="rounded-xl border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                            <p className="text-sm text-muted-foreground">
                                No red lines defined. Create a workgroup first, then add a red line for it.
                            </p>
                        </div>
                    )}
                    {redLines.map((rl) => (
                        <div key={rl.id} className="rounded-xl border border-sidebar-border/70 overflow-hidden dark:border-sidebar-border">
                            <div className="flex items-center justify-between border-b border-sidebar-border/70 bg-muted/50 px-4 py-2">
                                <span className="font-medium">
                                    {rl.workgroup_name ?? `Workgroup #${rl.workgroup_id}`} — Red line at position {rl.red_line_position}
                                </span>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(rl)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(rl.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                                <div>
                                    <h3 className="text-sm font-medium text-green-700 dark:text-green-400">Above line ({rl.users_above.length})</h3>
                                    <ul className="mt-1 space-y-1 text-sm">
                                        {rl.users_above.length === 0 && <li className="text-muted-foreground">None</li>}
                                        {rl.users_above.map((u) => (
                                            <li key={u.id}>
                                                {u.seniority_number != null ? `#${u.seniority_number} — ` : ''}
                                                {u.name} ({u.email})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400">Below line ({rl.users_below.length})</h3>
                                    <ul className="mt-1 space-y-1 text-sm">
                                        {rl.users_below.length === 0 && <li className="text-muted-foreground">None</li>}
                                        {rl.users_below.map((u) => (
                                            <li key={u.id}>{u.name} ({u.email})</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add red line</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitCreate} className="space-y-4">
                        <div>
                            <Label>Workgroup</Label>
                            <Select
                                value={createForm.workgroup_id}
                                onValueChange={(v) => setCreateForm((f) => ({ ...f, workgroup_id: v }))}
                                required
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select workgroup" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workgroups.map((wg) => (
                                        <SelectItem key={wg.id} value={wg.id.toString()}>{wg.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="create-position">Red line position (number of users above the line)</Label>
                            <Input
                                id="create-position"
                                type="number"
                                min={0}
                                value={createForm.red_line_position}
                                onChange={(e) => setCreateForm((f) => ({ ...f, red_line_position: parseInt(e.target.value, 10) || 0 }))}
                                className="mt-1"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button type="submit">Create</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit red line position</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitUpdate} className="space-y-4">
                        <div>
                            <Label htmlFor="edit-position">Position (number of users above the line)</Label>
                            <Input
                                id="edit-position"
                                type="number"
                                min={0}
                                value={editPosition}
                                onChange={(e) => setEditPosition(parseInt(e.target.value, 10) || 0)}
                                className="mt-1"
                            />
                        </div>
                        {editing && editing.users_above.length > 0 && (
                            <div>
                                <Label className="mb-2 block">Seniority number (above the line)</Label>
                                <p className="mb-2 text-xs text-muted-foreground">
                                    Assign a seniority number (1 = highest) for each person above the line. Lower number = higher seniority. Leave blank to use classification seniority date order.
                                </p>
                                <div className="space-y-2 rounded-md border p-3">
                                    {aboveLineSeniority.map((u) => {
                                        const user = editing.users_above.find((x) => x.id === u.user_id);
                                        return (
                                            <div key={u.user_id} className="flex flex-wrap items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    placeholder="#"
                                                    value={u.seniority_number ?? ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value.trim();
                                                        setSeniorityForUser(u.user_id, v === '' ? null : parseInt(v, 10) || null);
                                                    }}
                                                    className="h-8 w-16"
                                                />
                                                <span className="text-sm">
                                                    {user?.name} ({user?.email})
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete red line?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will remove the red line for this workgroup. It can be recreated later.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={submitDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
