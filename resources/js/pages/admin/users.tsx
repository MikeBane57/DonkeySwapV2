import { Head, router, usePage } from '@inertiajs/react';
import { Plus, Pencil, Search } from 'lucide-react';
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
    { title: 'User Manager', href: '/app/admin/users' },
];

type WorkgroupQualificationOption = { id: number; code: string; label: string };

type WorkgroupAssignment = {
    id: number;
    name: string;
    classification_seniority_date: string | null;
    qualification_ids: number[];
};

type UserRow = {
    id: number;
    name: string;
    email: string;
    employee_id?: string | null;
    phone: string | null;
    preferred_contact_method: string | null;
    role: string;
    time_display_preference: string;
    workgroups: WorkgroupAssignment[];
};

type WorkgroupOption = { id: number; name: string; qualifications: WorkgroupQualificationOption[] };

type WorkgroupFormItem = {
    workgroup_id: number;
    name: string;
    assigned: boolean;
    classification_seniority_date: string;
    qualification_ids: number[];
};

export default function AdminUsers() {
    const props = usePage().props as unknown as {
        users?: UserRow[];
        workgroups?: WorkgroupOption[];
        flash?: { success?: string; error?: string };
    };
    const users = props.users ?? [];
    const workgroups = props.workgroups ?? [];
    const flash = props.flash;
    const [success, setSuccess] = useState(flash?.success ?? null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = searchQuery.trim() === ''
        ? users
        : users.filter((user) => {
              const q = searchQuery.trim().toLowerCase();
              const name = (user.name ?? '').toLowerCase();
              const email = (user.email ?? '').toLowerCase();
              const role = (user.role ?? '').toLowerCase();
              const workgroupNames = (user.workgroups ?? []).map((wg) => wg.name.toLowerCase()).join(' ');
              return name.includes(q) || email.includes(q) || role.includes(q) || workgroupNames.includes(q);
          });
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [form, setForm] = useState<{
        name: string;
        email: string;
        employee_id: string;
        phone: string;
        preferred_contact_method: string;
        role: string;
        time_display_preference: string;
        workgroups: WorkgroupFormItem[];
    }>({ name: '', email: '', employee_id: '', phone: '', preferred_contact_method: 'email', role: 'worker', time_display_preference: 'central', workgroups: [] });
    const [createForm, setCreateForm] = useState<{
        name: string;
        email: string;
        employee_id: string;
        password: string;
        password_confirmation: string;
        role: string;
        time_display_preference: string;
        preferred_contact_method: string;
        phone: string;
        workgroups: WorkgroupFormItem[];
    }>({
        name: '',
        email: '',
        employee_id: '',
        password: '',
        password_confirmation: '',
        role: 'worker',
        time_display_preference: 'central',
        preferred_contact_method: 'email',
        phone: '',
        workgroups: [],
    });

    const openCreate = () => {
        const dispatchWg = workgroups.find((wg) => wg.name.toLowerCase() === 'dispatch');
        const assistantQualId = dispatchWg?.qualifications?.find((q) => q.code.toUpperCase() === 'ASST')?.id;
        const workgroupsForm: WorkgroupFormItem[] = workgroups.map((wg) => {
            const isDispatch = wg.name.toLowerCase() === 'dispatch';
            return {
                workgroup_id: wg.id,
                name: wg.name,
                assigned: isDispatch,
                classification_seniority_date: '',
                qualification_ids: isDispatch && assistantQualId != null ? [assistantQualId] : [],
            };
        });
        setCreateForm({
            name: '',
            email: '',
            employee_id: '',
            password: '',
            password_confirmation: '',
            role: 'worker',
            time_display_preference: 'central',
            preferred_contact_method: 'email',
            phone: '',
            workgroups: workgroupsForm,
        });
        setCreateOpen(true);
    };

    const setCreateAssigned = (workgroup_id: number, assigned: boolean) => {
        setCreateForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) =>
                w.workgroup_id === workgroup_id ? { ...w, assigned } : w
            ),
        }));
    };

    const setCreateSeniorityDate = (workgroup_id: number, value: string) => {
        setCreateForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) =>
                w.workgroup_id === workgroup_id ? { ...w, classification_seniority_date: value } : w
            ),
        }));
    };

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const workgroupsPayload = createForm.workgroups
            .filter((w) => w.assigned)
            .map((w) => ({
                workgroup_id: w.workgroup_id,
                classification_seniority_date: w.classification_seniority_date || null,
                qualification_ids: w.qualification_ids,
            }));
        router.post('/app/admin/users', {
            name: createForm.name,
            email: createForm.email,
            employee_id: createForm.employee_id || null,
            password: createForm.password,
            password_confirmation: createForm.password_confirmation,
            role: createForm.role,
            time_display_preference: createForm.time_display_preference,
            preferred_contact_method: createForm.preferred_contact_method,
            phone: createForm.phone || null,
            workgroups: workgroupsPayload,
        }, {
            onSuccess: () => {
                setCreateOpen(false);
                setSearchQuery('');
                setSuccess('User created.');
            },
        });
    };

    const openEdit = (user: UserRow) => {
        const assignedIds = new Set(user.workgroups.map((wg) => wg.id));
        const workgroupsForm: WorkgroupFormItem[] = workgroups.map((wg) => {
            const assigned = assignedIds.has(wg.id);
            const existing = user.workgroups.find((x) => x.id === wg.id);
            return {
                workgroup_id: wg.id,
                name: wg.name,
                assigned,
                classification_seniority_date: existing?.classification_seniority_date ?? '',
                qualification_ids: existing?.qualification_ids ?? [],
            };
        });
        setEditing(user);
        setForm({
            name: user.name,
            email: user.email,
            employee_id: user.employee_id ?? '',
            phone: user.phone ?? '',
            preferred_contact_method: user.preferred_contact_method ?? 'email',
            role: user.role,
            time_display_preference: user.time_display_preference ?? 'central',
            workgroups: workgroupsForm,
        });
    };

    const setAssigned = (workgroup_id: number, assigned: boolean) => {
        setForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) =>
                w.workgroup_id === workgroup_id ? { ...w, assigned } : w
            ),
        }));
    };

    const setSeniorityDate = (workgroup_id: number, value: string) => {
        setForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) =>
                w.workgroup_id === workgroup_id ? { ...w, classification_seniority_date: value } : w
            ),
        }));
    };

    const setQualification = (workgroup_id: number, qualificationId: number, checked: boolean) => {
        setForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) => {
                if (w.workgroup_id !== workgroup_id) return w;
                const ids = new Set(w.qualification_ids);
                if (checked) ids.add(qualificationId);
                else ids.delete(qualificationId);
                return { ...w, qualification_ids: Array.from(ids) };
            }),
        }));
    };

    const setCreateQualification = (workgroup_id: number, qualificationId: number, checked: boolean) => {
        setCreateForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) => {
                if (w.workgroup_id !== workgroup_id) return w;
                const ids = new Set(w.qualification_ids);
                if (checked) ids.add(qualificationId);
                else ids.delete(qualificationId);
                return { ...w, qualification_ids: Array.from(ids) };
            }),
        }));
    };

    const submitUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        const workgroupsPayload = form.workgroups
            .filter((w) => w.assigned)
            .map((w) => ({
                workgroup_id: w.workgroup_id,
                classification_seniority_date: w.classification_seniority_date || null,
                qualification_ids: w.qualification_ids,
            }));
        router.put(`/app/admin/users/${editing.id}`, {
            name: form.name,
            email: form.email,
            employee_id: form.employee_id || null,
            phone: form.phone || null,
            preferred_contact_method: form.preferred_contact_method,
            role: form.role,
            time_display_preference: form.time_display_preference,
            workgroups: workgroupsPayload,
        }, {
            onSuccess: () => {
                setEditing(null);
                setSuccess('User updated.');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Manager - Admin" />
            <div className="p-4">
                <h1 className="text-2xl font-semibold">User Manager</h1>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted-foreground text-sm">
                        Add or edit users: role, time display, and workgroup assignments with qualifications and seniority dates.
                    </p>
                    <Button onClick={openCreate} disabled={workgroups.length === 0}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add user
                    </Button>
                </div>
                {success && (
                    <div className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        {success}
                    </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by name, email, role, or workgroup…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                            aria-label="Search users"
                        />
                    </div>
                    {searchQuery.trim() && (
                        <span className="text-sm text-muted-foreground">
                            {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Email</th>
                                <th className="px-4 py-3 font-medium">EMPID</th>
                                <th className="px-4 py-3 font-medium">Phone</th>
                                <th className="px-4 py-3 font-medium">Role</th>
                                <th className="px-4 py-3 font-medium">Workgroups</th>
                                <th className="px-4 py-3 font-medium">Seniority (per workgroup)</th>
                                <th className="px-4 py-3 font-medium">Qualifications</th>
                                <th className="px-4 py-3 text-right font-medium w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                        {users.length === 0
                                            ? 'No users found.'
                                            : 'No users match your search.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="border-b border-sidebar-border/50 dark:border-sidebar-border/50"
                                    >
                                        <td className="px-4 py-3">{user.name}</td>
                                        <td className="px-4 py-3">{user.email}</td>
                                        <td className="px-4 py-3">{user.employee_id ?? '—'}</td>
                                        <td className="px-4 py-3">{user.phone ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className="rounded bg-muted px-2 py-0.5 font-medium">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.workgroups.length === 0
                                                ? '—'
                                                : user.workgroups.map((wg) => wg.name).join(', ')}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.workgroups.length === 0
                                                ? '—'
                                                : user.workgroups
                                                      .map(
                                                          (wg) =>
                                                              `${wg.name}: ${wg.classification_seniority_date ?? '—'}`
                                                      )
                                                      .join('; ')}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.workgroups.length === 0
                                                ? '—'
                                                : user.workgroups
                                                      .map((wg) => {
                                                          const wgOpt = workgroups.find((g) => g.id === wg.id);
                                                          const labels = (wgOpt?.qualifications ?? [])
                                                              .filter((q) => wg.qualification_ids?.includes(q.id))
                                                              .map((q) => q.label);
                                                          return `${wg.name}: ${labels.length ? labels.join(', ') : '—'}`;
                                                      })
                                                      .join('; ')}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden p-0 gap-0">
                    <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
                        <DialogTitle>Add user</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitCreate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-2">
                            <div className="space-y-4">
                        <div>
                            <Label htmlFor="create-name">Name</Label>
                            <Input
                                id="create-name"
                                value={createForm.name}
                                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="create-email">Email</Label>
                            <Input
                                id="create-email"
                                type="email"
                                value={createForm.email}
                                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="create-employee-id">Employee ID (optional)</Label>
                            <Input
                                id="create-employee-id"
                                value={createForm.employee_id}
                                onChange={(e) => setCreateForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="mt-1"
                                placeholder="e.g. 121883"
                            />
                        </div>
                        <div>
                            <Label htmlFor="create-phone">Phone (optional)</Label>
                            <Input
                                id="create-phone"
                                type="tel"
                                value={createForm.phone}
                                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                                className="mt-1"
                                placeholder="e.g. 555-123-4567"
                            />
                        </div>
                        <div>
                            <Label>Preferred contact</Label>
                            <Select
                                value={createForm.preferred_contact_method}
                                onValueChange={(v) => setCreateForm((f) => ({ ...f, preferred_contact_method: v }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="call">Call</SelectItem>
                                    <SelectItem value="text">Text</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="create-password">Password</Label>
                            <Input
                                id="create-password"
                                type="password"
                                value={createForm.password}
                                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="create-password-confirmation">Confirm password</Label>
                            <Input
                                id="create-password-confirmation"
                                type="password"
                                value={createForm.password_confirmation}
                                onChange={(e) => setCreateForm((f) => ({ ...f, password_confirmation: e.target.value }))}
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Role</Label>
                            <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="worker">Worker</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Time display</Label>
                            <Select
                                value={createForm.time_display_preference}
                                onValueChange={(v) => setCreateForm((f) => ({ ...f, time_display_preference: v }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="central">Central</SelectItem>
                                    <SelectItem value="central_zulu">Central + Zulu</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="mb-2 block">Workgroup assignments</Label>
                            <div className="space-y-3 rounded-md border p-3">
                                {createForm.workgroups.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No workgroups defined. Create workgroups first.</p>
                                )}
                                {createForm.workgroups.map((w) => (
                                    <div key={w.workgroup_id} className="flex flex-wrap items-center gap-3 border-b pb-2 last:border-0 last:pb-0">
                                        <Label className="flex items-center gap-2 font-normal">
                                            <Checkbox
                                                checked={w.assigned}
                                                onCheckedChange={(v) => setCreateAssigned(w.workgroup_id, v === true)}
                                            />
                                            {w.name}
                                        </Label>
                                        {w.assigned && (
                                            <>
                                                <Input
                                                    type="date"
                                                    value={w.classification_seniority_date}
                                                    onChange={(e) => setCreateSeniorityDate(w.workgroup_id, e.target.value)}
                                                    placeholder="Seniority date"
                                                    className="h-8 w-40"
                                                />
                                                {(workgroups.find((wg) => wg.id === w.workgroup_id)?.qualifications?.length ?? 0) > 0 && (
                                                    <div className="flex flex-wrap gap-2 w-full">
                                                        {workgroups.find((wg) => wg.id === w.workgroup_id)?.qualifications?.map((q) => (
                                                            <Label key={q.id} className="flex items-center gap-1.5 text-xs font-normal">
                                                                <Checkbox
                                                                    checked={w.qualification_ids.includes(q.id)}
                                                                    onCheckedChange={(v) => setCreateQualification(w.workgroup_id, q.id, v === true)}
                                                                />
                                                                {q.label}
                                                            </Label>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        </div>
                        </div>
                        <DialogFooter className="shrink-0 border-t px-6 py-4 mt-0">
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Create user</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden p-0 gap-0">
                    <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
                        <DialogTitle>Edit user {editing?.email}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitUpdate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-2">
                            <div className="space-y-4">
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
                        <div>
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-employee-id">Employee ID (optional)</Label>
                            <Input
                                id="edit-employee-id"
                                value={form.employee_id}
                                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="mt-1"
                                placeholder="e.g. 121883"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-phone">Phone</Label>
                            <Input
                                id="edit-phone"
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                className="mt-1"
                                placeholder="e.g. 555-123-4567"
                            />
                        </div>
                        <div>
                            <Label>Preferred contact</Label>
                            <Select
                                value={form.preferred_contact_method}
                                onValueChange={(v) => setForm((f) => ({ ...f, preferred_contact_method: v }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="call">Call</SelectItem>
                                    <SelectItem value="text">Text</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Role</Label>
                            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="worker">Worker</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Time display</Label>
                            <Select
                                value={form.time_display_preference}
                                onValueChange={(v) => setForm((f) => ({ ...f, time_display_preference: v }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="central">Central</SelectItem>
                                    <SelectItem value="central_zulu">Central + Zulu</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="mb-2 block">Workgroup assignments</Label>
                            <div className="space-y-3 rounded-md border p-3">
                                {form.workgroups.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No workgroups defined. Create workgroups first.</p>
                                )}
                                {form.workgroups.map((w) => (
                                    <div key={w.workgroup_id} className="flex flex-wrap items-center gap-3 border-b pb-2 last:border-0 last:pb-0">
                                        <Label className="flex items-center gap-2 font-normal">
                                            <Checkbox
                                                checked={w.assigned}
                                                onCheckedChange={(v) => setAssigned(w.workgroup_id, v === true)}
                                            />
                                            {w.name}
                                        </Label>
                                        {w.assigned && (
                                            <>
                                                <Input
                                                    type="date"
                                                    value={w.classification_seniority_date}
                                                    onChange={(e) => setSeniorityDate(w.workgroup_id, e.target.value)}
                                                    placeholder="Seniority date"
                                                    className="h-8 w-40"
                                                />
                                                {(workgroups.find((wg) => wg.id === w.workgroup_id)?.qualifications?.length ?? 0) > 0 && (
                                                    <div className="flex flex-wrap gap-2 w-full">
                                                        {workgroups.find((wg) => wg.id === w.workgroup_id)?.qualifications?.map((q) => (
                                                            <Label key={q.id} className="flex items-center gap-1.5 text-xs font-normal">
                                                                <Checkbox
                                                                    checked={w.qualification_ids.includes(q.id)}
                                                                    onCheckedChange={(v) => setQualification(w.workgroup_id, q.id, v === true)}
                                                                />
                                                                {q.label}
                                                            </Label>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        </div>
                        </div>
                        <DialogFooter className="shrink-0 border-t px-6 py-4 mt-0">
                            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}