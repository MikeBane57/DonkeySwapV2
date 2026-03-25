import { Head, router, usePage } from '@inertiajs/react';
import { KeyRound, Plus, Pencil, Search, Trash2, Upload } from 'lucide-react';
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

type WorkgroupOption = {
    id: number;
    name: string;
    qualifications: WorkgroupQualificationOption[];
};

type WorkgroupFormItem = {
    workgroup_id: number;
    name: string;
    assigned: boolean;
    classification_seniority_date: string;
    qualification_ids: number[];
};

export default function AdminUsers() {
    const page = usePage();
    const {
        users = [],
        workgroups = [],
        default_user_password: defaultUserPassword = '',
        flash,
        auth,
    } = page.props as {
        users?: UserRow[];
        workgroups?: WorkgroupOption[];
        default_user_password?: string;
        flash?: { success?: string; error?: string };
        auth?: { user?: { id: number } };
    };
    const { errors: pageErrors } = page.props as {
        errors?: Record<string, string>;
    };
    const validationErrorMessages = pageErrors
        ? Array.from(new Set(Object.values(pageErrors).filter(Boolean)))
        : [];
    const currentUserId = auth?.user?.id;
    const [localSuccess, setLocalSuccess] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const success = flash?.success ?? localSuccess;
    const error = flash?.error !== undefined ? flash.error : localError;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers =
        searchQuery.trim() === ''
            ? users
            : users.filter((user) => {
                  const q = searchQuery.trim().toLowerCase();
                  const name = (user.name ?? '').toLowerCase();
                  const email = (user.email ?? '').toLowerCase();
                  const role = (user.role ?? '').toLowerCase();
                  const workgroupNames = (user.workgroups ?? [])
                      .map((wg) => wg.name.toLowerCase())
                      .join(' ');
                  return (
                      name.includes(q) ||
                      email.includes(q) ||
                      role.includes(q) ||
                      workgroupNames.includes(q)
                  );
              });
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [importForm, setImportForm] = useState({
        csv_content: '',
    });
    const [importFile, setImportFile] = useState<File | null>(null);
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
    }>({
        name: '',
        email: '',
        employee_id: '',
        phone: '',
        preferred_contact_method: 'email',
        role: 'worker',
        time_display_preference: 'central',
        workgroups: [],
    });
    const [createForm, setCreateForm] = useState<{
        name: string;
        email: string;
        employee_id: string;
        role: string;
        time_display_preference: string;
        preferred_contact_method: string;
        phone: string;
        workgroups: WorkgroupFormItem[];
    }>({
        name: '',
        email: '',
        employee_id: '',
        role: 'worker',
        time_display_preference: 'central',
        preferred_contact_method: 'email',
        phone: '',
        workgroups: [],
    });

    const openCreate = () => {
        const dispatchWg = workgroups.find(
            (wg) => wg.name.toLowerCase() === 'dispatch',
        );
        const assistantQualId = dispatchWg?.qualifications?.find(
            (q) => q.code.toUpperCase() === 'ASST',
        )?.id;
        const workgroupsForm: WorkgroupFormItem[] = workgroups.map((wg) => {
            const isDispatch = wg.name.toLowerCase() === 'dispatch';
            return {
                workgroup_id: wg.id,
                name: wg.name,
                assigned: isDispatch,
                classification_seniority_date: '',
                qualification_ids:
                    isDispatch && assistantQualId != null
                        ? [assistantQualId]
                        : [],
            };
        });
        setCreateForm({
            name: '',
            email: '',
            employee_id: '',
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
                w.workgroup_id === workgroup_id ? { ...w, assigned } : w,
            ),
        }));
    };

    const setCreateSeniorityDate = (workgroup_id: number, value: string) => {
        setCreateForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) =>
                w.workgroup_id === workgroup_id
                    ? { ...w, classification_seniority_date: value }
                    : w,
            ),
        }));
    };

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const workgroupsPayload = createForm.workgroups
            .filter((w) => w.assigned)
            .map((w) => ({
                workgroup_id: w.workgroup_id,
                classification_seniority_date:
                    w.classification_seniority_date || null,
                qualification_ids: w.qualification_ids,
            }));
        router.post(
            '/app/admin/users',
            {
                name: createForm.name,
                email: createForm.email,
                employee_id: createForm.employee_id || null,
                role: createForm.role,
                time_display_preference: createForm.time_display_preference,
                preferred_contact_method: createForm.preferred_contact_method,
                phone: createForm.phone || null,
                workgroups: workgroupsPayload,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCreateOpen(false);
                    setSearchQuery('');
                    setLocalSuccess('User created.');
                    setLocalError(null);
                },
            },
        );
    };

    const openImport = () => {
        setImportForm({ csv_content: '' });
        setImportFile(null);
        setImportOpen(true);
    };

    const submitImport = (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile && importForm.csv_content.trim() === '') {
            setLocalError('Choose a CSV file or paste CSV content.');
            return;
        }
        if (importFile) {
            router.post(
                '/app/admin/users/import',
                { file: importFile },
                {
                    forceFormData: true,
                    preserveScroll: true,
                    onSuccess: () => {
                        setImportOpen(false);
                        setImportForm({ csv_content: '' });
                        setImportFile(null);
                        setSearchQuery('');
                        setLocalError(null);
                    },
                },
            );
        } else {
            router.post(
                '/app/admin/users/import',
                { csv_content: importForm.csv_content },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setImportOpen(false);
                        setImportForm({ csv_content: '' });
                        setSearchQuery('');
                        setLocalError(null);
                    },
                },
            );
        }
    };

    const submitDelete = () => {
        const id = deleteId;
        if (id == null) return;
        router.delete(`/app/admin/users/${id}`, {
            onSuccess: () => {
                setDeleteId(null);
                setEditing((e) => (e?.id === id ? null : e));
                setLocalError(null);
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
                classification_seniority_date:
                    existing?.classification_seniority_date ?? '',
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
                w.workgroup_id === workgroup_id ? { ...w, assigned } : w,
            ),
        }));
    };

    const setSeniorityDate = (workgroup_id: number, value: string) => {
        setForm((f) => ({
            ...f,
            workgroups: f.workgroups.map((w) =>
                w.workgroup_id === workgroup_id
                    ? { ...w, classification_seniority_date: value }
                    : w,
            ),
        }));
    };

    const setQualification = (
        workgroup_id: number,
        qualificationId: number,
        checked: boolean,
    ) => {
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

    const setCreateQualification = (
        workgroup_id: number,
        qualificationId: number,
        checked: boolean,
    ) => {
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

    const submitResetPassword = () => {
        if (!editing) return;
        if (
            !confirm(
                `Reset password for ${editing.email} to the standard initial password? They should change it after signing in.`,
            )
        ) {
            return;
        }
        router.post(
            `/app/admin/users/${editing.id}/reset-password`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setEditing(null);
                    setLocalError(null);
                },
            },
        );
    };

    const submitUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        const workgroupsPayload = form.workgroups
            .filter((w) => w.assigned)
            .map((w) => ({
                workgroup_id: w.workgroup_id,
                classification_seniority_date:
                    w.classification_seniority_date || null,
                qualification_ids: w.qualification_ids,
            }));
        router.put(
            `/app/admin/users/${editing.id}`,
            {
                name: form.name,
                email: form.email,
                employee_id: form.employee_id || null,
                phone: form.phone || null,
                preferred_contact_method: form.preferred_contact_method,
                role: form.role,
                time_display_preference: form.time_display_preference,
                workgroups: workgroupsPayload,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setEditing(null);
                    setLocalSuccess('User updated.');
                    setLocalError(null);
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Manager - Admin" />
            <div className="p-4">
                <h1 className="text-2xl font-semibold">User Manager</h1>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                        Add or edit users: role, time display, and workgroup
                        assignments with qualifications and seniority dates.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={openImport}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Import users
                        </Button>
                        <Button
                            onClick={openCreate}
                            disabled={workgroups.length === 0}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add user
                        </Button>
                    </div>
                </div>
                {success && (
                    <div className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        {success}
                    </div>
                )}
                {error && (
                    <div className="mt-3 rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}
                {validationErrorMessages.length > 0 && (
                    <div
                        className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        role="alert"
                    >
                        <p className="font-medium text-foreground">
                            Could not save — please fix the following:
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            {validationErrorMessages.map((msg, i) => (
                                <li key={`${i}-${msg}`}>{msg}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                    <div className="relative max-w-sm flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
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
                            {filteredUsers.length} of {users.length} user
                            {users.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="w-full min-w-0 overflow-x-auto">
                        <table className="w-full min-w-max text-left text-sm">
                            <thead className="border-b border-sidebar-border/70 bg-muted/50 dark:border-sidebar-border">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Name
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Email
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        EMPID
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Phone
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Role
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Workgroups
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Seniority (per workgroup)
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Qualifications
                                    </th>
                                    <th className="w-28 px-4 py-3 text-right font-medium">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="px-4 py-8 text-center text-muted-foreground"
                                        >
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
                                            <td className="px-4 py-3">
                                                {user.name}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.email}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.employee_id ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.phone ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="rounded bg-muted px-2 py-0.5 font-medium">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.workgroups.length === 0
                                                    ? '—'
                                                    : user.workgroups
                                                          .map((wg) => wg.name)
                                                          .join(', ')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.workgroups.length === 0
                                                    ? '—'
                                                    : user.workgroups
                                                          .map(
                                                              (wg) =>
                                                                  `${wg.name}: ${wg.classification_seniority_date ?? '—'}`,
                                                          )
                                                          .join('; ')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.workgroups.length === 0
                                                    ? '—'
                                                    : user.workgroups
                                                          .map((wg) => {
                                                              const wgOpt =
                                                                  workgroups.find(
                                                                      (g) =>
                                                                          g.id ===
                                                                          wg.id,
                                                                  );
                                                              const labels = (
                                                                  wgOpt?.qualifications ??
                                                                  []
                                                              )
                                                                  .filter((q) =>
                                                                      wg.qualification_ids?.includes(
                                                                          q.id,
                                                                      ),
                                                                  )
                                                                  .map(
                                                                      (q) =>
                                                                          q.label,
                                                                  );
                                                              return `${wg.name}: ${labels.length ? labels.join(', ') : '—'}`;
                                                          })
                                                          .join('; ')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            openEdit(user)
                                                        }
                                                        title="Edit user"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        title="Delete user"
                                                        disabled={
                                                            currentUserId !=
                                                                null &&
                                                            user.id ===
                                                                currentUserId
                                                        }
                                                        onClick={() =>
                                                            setDeleteId(user.id)
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
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
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
                        <DialogTitle>Add user</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={submitCreate}
                        className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="create-name">Name</Label>
                                    <Input
                                        id="create-name"
                                        value={createForm.name}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                name: e.target.value,
                                            }))
                                        }
                                        required
                                        className="mt-1"
                                        aria-invalid={!!pageErrors?.name}
                                    />
                                    {pageErrors?.name && (
                                        <p className="mt-1 text-sm text-destructive">
                                            {pageErrors.name}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="create-email">Email</Label>
                                    <Input
                                        id="create-email"
                                        type="email"
                                        value={createForm.email}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                email: e.target.value,
                                            }))
                                        }
                                        required
                                        className="mt-1"
                                        aria-invalid={!!pageErrors?.email}
                                    />
                                    {pageErrors?.email && (
                                        <p className="mt-1 text-sm text-destructive">
                                            {pageErrors.email}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="create-employee-id">
                                        Employee ID (optional)
                                    </Label>
                                    <Input
                                        id="create-employee-id"
                                        value={createForm.employee_id}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                employee_id: e.target.value,
                                            }))
                                        }
                                        className="mt-1"
                                        placeholder="e.g. 121883"
                                        aria-invalid={!!pageErrors?.employee_id}
                                    />
                                    {pageErrors?.employee_id && (
                                        <p className="mt-1 text-sm text-destructive">
                                            {pageErrors.employee_id}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="create-phone">
                                        Phone (optional)
                                    </Label>
                                    <Input
                                        id="create-phone"
                                        type="tel"
                                        value={createForm.phone}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                phone: e.target.value,
                                            }))
                                        }
                                        className="mt-1"
                                        placeholder="e.g. 555-123-4567"
                                    />
                                </div>
                                <div>
                                    <Label>Preferred contact</Label>
                                    <Select
                                        value={
                                            createForm.preferred_contact_method
                                        }
                                        onValueChange={(v) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                preferred_contact_method: v,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="email">
                                                Email
                                            </SelectItem>
                                            <SelectItem value="call">
                                                Call
                                            </SelectItem>
                                            <SelectItem value="text">
                                                Text
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="rounded-md border border-sidebar-border/70 bg-muted/30 px-3 py-2 text-sm dark:border-sidebar-border">
                                    <p className="font-medium text-foreground">
                                        Initial password
                                    </p>
                                    <p className="mt-1.5 font-mono text-sm text-foreground">
                                        {defaultUserPassword || '—'}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Share this with the user for first
                                        sign-in; they should change it under
                                        account settings. CSV imports use the
                                        same password. Admins can reset a user
                                        to this value from Edit user.
                                    </p>
                                </div>
                                <div>
                                    <Label>Role</Label>
                                    <Select
                                        value={createForm.role}
                                        onValueChange={(v) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                role: v,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="worker">
                                                Worker
                                            </SelectItem>
                                            <SelectItem value="manager">
                                                Manager
                                            </SelectItem>
                                            <SelectItem value="admin">
                                                Admin
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Time display</Label>
                                    <Select
                                        value={
                                            createForm.time_display_preference
                                        }
                                        onValueChange={(v) =>
                                            setCreateForm((f) => ({
                                                ...f,
                                                time_display_preference: v,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="central">
                                                Central
                                            </SelectItem>
                                            <SelectItem value="central_zulu">
                                                Central + Zulu
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="mb-2 block">
                                        Workgroup assignments
                                    </Label>
                                    {pageErrors &&
                                        Object.keys(pageErrors).some((k) =>
                                            k.startsWith('workgroups'),
                                        ) && (
                                            <p className="mb-2 text-sm text-destructive">
                                                {Object.entries(pageErrors)
                                                    .filter(([k]) =>
                                                        k.startsWith(
                                                            'workgroups',
                                                        ),
                                                    )
                                                    .map(([, v]) => v)
                                                    .filter(Boolean)
                                                    .filter(
                                                        (v, i, a) =>
                                                            a.indexOf(v) === i,
                                                    )
                                                    .join(' ')}
                                            </p>
                                        )}
                                    <div className="space-y-3 rounded-md border p-3">
                                        {createForm.workgroups.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                No workgroups defined. Create
                                                workgroups first.
                                            </p>
                                        )}
                                        {createForm.workgroups.map((w) => (
                                            <div
                                                key={w.workgroup_id}
                                                className="flex flex-wrap items-center gap-3 border-b pb-2 last:border-0 last:pb-0"
                                            >
                                                <Label className="flex items-center gap-2 font-normal">
                                                    <Checkbox
                                                        checked={w.assigned}
                                                        onCheckedChange={(v) =>
                                                            setCreateAssigned(
                                                                w.workgroup_id,
                                                                v === true,
                                                            )
                                                        }
                                                    />
                                                    {w.name}
                                                </Label>
                                                {w.assigned && (
                                                    <>
                                                        <Input
                                                            type="date"
                                                            value={
                                                                w.classification_seniority_date
                                                            }
                                                            onChange={(e) =>
                                                                setCreateSeniorityDate(
                                                                    w.workgroup_id,
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Seniority date"
                                                            className="h-8 w-40"
                                                        />
                                                        {(workgroups.find(
                                                            (wg) =>
                                                                wg.id ===
                                                                w.workgroup_id,
                                                        )?.qualifications
                                                            ?.length ?? 0) >
                                                            0 && (
                                                            <div className="flex w-full flex-wrap gap-2">
                                                                {workgroups
                                                                    .find(
                                                                        (wg) =>
                                                                            wg.id ===
                                                                            w.workgroup_id,
                                                                    )
                                                                    ?.qualifications?.map(
                                                                        (q) => (
                                                                            <Label
                                                                                key={
                                                                                    q.id
                                                                                }
                                                                                className="flex items-center gap-1.5 text-xs font-normal"
                                                                            >
                                                                                <Checkbox
                                                                                    checked={w.qualification_ids.includes(
                                                                                        q.id,
                                                                                    )}
                                                                                    onCheckedChange={(
                                                                                        v,
                                                                                    ) =>
                                                                                        setCreateQualification(
                                                                                            w.workgroup_id,
                                                                                            q.id,
                                                                                            v ===
                                                                                                true,
                                                                                        )
                                                                                    }
                                                                                />
                                                                                {
                                                                                    q.label
                                                                                }
                                                                            </Label>
                                                                        ),
                                                                    )}
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
                        <DialogFooter className="mt-0 shrink-0 border-t px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Create user</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!editing}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
                        <DialogTitle>Edit user {editing?.email}</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={submitUpdate}
                        className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="edit-name">Name</Label>
                                    <Input
                                        id="edit-name"
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                name: e.target.value,
                                            }))
                                        }
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
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                email: e.target.value,
                                            }))
                                        }
                                        required
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-employee-id">
                                        Employee ID (optional)
                                    </Label>
                                    <Input
                                        id="edit-employee-id"
                                        value={form.employee_id}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                employee_id: e.target.value,
                                            }))
                                        }
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
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                phone: e.target.value,
                                            }))
                                        }
                                        className="mt-1"
                                        placeholder="e.g. 555-123-4567"
                                    />
                                </div>
                                <div>
                                    <Label>Preferred contact</Label>
                                    <Select
                                        value={form.preferred_contact_method}
                                        onValueChange={(v) =>
                                            setForm((f) => ({
                                                ...f,
                                                preferred_contact_method: v,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="email">
                                                Email
                                            </SelectItem>
                                            <SelectItem value="call">
                                                Call
                                            </SelectItem>
                                            <SelectItem value="text">
                                                Text
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="rounded-md border border-sidebar-border/70 bg-muted/30 px-3 py-3 dark:border-sidebar-border">
                                    <p className="text-sm font-medium text-foreground">
                                        Password
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Reset to the initial password (
                                        <span className="font-mono text-foreground">
                                            {defaultUserPassword || '—'}
                                        </span>
                                        ). They should change it after signing
                                        in.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-3 gap-1.5"
                                        onClick={submitResetPassword}
                                    >
                                        <KeyRound className="h-4 w-4" />
                                        Reset to default password
                                    </Button>
                                </div>
                                <div>
                                    <Label>Role</Label>
                                    <Select
                                        value={form.role}
                                        onValueChange={(v) =>
                                            setForm((f) => ({ ...f, role: v }))
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="worker">
                                                Worker
                                            </SelectItem>
                                            <SelectItem value="manager">
                                                Manager
                                            </SelectItem>
                                            <SelectItem value="admin">
                                                Admin
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Time display</Label>
                                    <Select
                                        value={form.time_display_preference}
                                        onValueChange={(v) =>
                                            setForm((f) => ({
                                                ...f,
                                                time_display_preference: v,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="central">
                                                Central
                                            </SelectItem>
                                            <SelectItem value="central_zulu">
                                                Central + Zulu
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="mb-2 block">
                                        Workgroup assignments
                                    </Label>
                                    <div className="space-y-3 rounded-md border p-3">
                                        {form.workgroups.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                No workgroups defined. Create
                                                workgroups first.
                                            </p>
                                        )}
                                        {form.workgroups.map((w) => (
                                            <div
                                                key={w.workgroup_id}
                                                className="flex flex-wrap items-center gap-3 border-b pb-2 last:border-0 last:pb-0"
                                            >
                                                <Label className="flex items-center gap-2 font-normal">
                                                    <Checkbox
                                                        checked={w.assigned}
                                                        onCheckedChange={(v) =>
                                                            setAssigned(
                                                                w.workgroup_id,
                                                                v === true,
                                                            )
                                                        }
                                                    />
                                                    {w.name}
                                                </Label>
                                                {w.assigned && (
                                                    <>
                                                        <Input
                                                            type="date"
                                                            value={
                                                                w.classification_seniority_date
                                                            }
                                                            onChange={(e) =>
                                                                setSeniorityDate(
                                                                    w.workgroup_id,
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Seniority date"
                                                            className="h-8 w-40"
                                                        />
                                                        {(workgroups.find(
                                                            (wg) =>
                                                                wg.id ===
                                                                w.workgroup_id,
                                                        )?.qualifications
                                                            ?.length ?? 0) >
                                                            0 && (
                                                            <div className="flex w-full flex-wrap gap-2">
                                                                {workgroups
                                                                    .find(
                                                                        (wg) =>
                                                                            wg.id ===
                                                                            w.workgroup_id,
                                                                    )
                                                                    ?.qualifications?.map(
                                                                        (q) => (
                                                                            <Label
                                                                                key={
                                                                                    q.id
                                                                                }
                                                                                className="flex items-center gap-1.5 text-xs font-normal"
                                                                            >
                                                                                <Checkbox
                                                                                    checked={w.qualification_ids.includes(
                                                                                        q.id,
                                                                                    )}
                                                                                    onCheckedChange={(
                                                                                        v,
                                                                                    ) =>
                                                                                        setQualification(
                                                                                            w.workgroup_id,
                                                                                            q.id,
                                                                                            v ===
                                                                                                true,
                                                                                        )
                                                                                    }
                                                                                />
                                                                                {
                                                                                    q.label
                                                                                }
                                                                            </Label>
                                                                        ),
                                                                    )}
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
                        <DialogFooter className="mt-0 shrink-0 border-t px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditing(null)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
                        <DialogTitle>Import users from CSV</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={submitImport}
                        className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    >
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-2">
                            <p className="text-sm text-muted-foreground">
                                The first row must be a header row. Use commas
                                to separate columns; if a value contains a
                                comma, wrap the cell in double quotes in your
                                CSV file.
                            </p>
                            <div className="rounded-lg border border-sidebar-border/70 bg-muted/30 px-3 py-3 dark:border-sidebar-border">
                                <p className="text-sm font-medium text-foreground">
                                    CSV schema
                                </p>
                                <dl className="mt-2 space-y-2 text-sm">
                                    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
                                        <dt className="font-mono text-xs text-foreground">
                                            name
                                        </dt>
                                        <dd className="text-muted-foreground">
                                            Required. Display name.
                                        </dd>
                                    </div>
                                    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
                                        <dt className="font-mono text-xs text-foreground">
                                            email
                                        </dt>
                                        <dd className="text-muted-foreground">
                                            Required. Must be unique; existing
                                            emails are skipped.
                                        </dd>
                                    </div>
                                    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
                                        <dt className="font-mono text-xs text-foreground">
                                            workgroups
                                        </dt>
                                        <dd className="text-muted-foreground">
                                            Required column (header name{' '}
                                            <span className="font-mono text-foreground">
                                                workgroups
                                            </span>{' '}
                                            or{' '}
                                            <span className="font-mono text-foreground">
                                                workgroup
                                            </span>{' '}
                                            for a single group). Cell value: one
                                            or more workgroup names separated by
                                            commas or semicolons. Names must
                                            match your workgroups below
                                            (case-insensitive). Leave empty for
                                            no workgroups.
                                        </dd>
                                    </div>
                                    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
                                        <dt className="font-mono text-xs text-foreground">
                                            employee_id
                                        </dt>
                                        <dd className="text-muted-foreground">
                                            Optional. Must be unique if set.
                                        </dd>
                                    </div>
                                    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
                                        <dt className="font-mono text-xs text-foreground">
                                            phone
                                        </dt>
                                        <dd className="text-muted-foreground">
                                            Optional.
                                        </dd>
                                    </div>
                                    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
                                        <dt className="font-mono text-xs text-foreground">
                                            role
                                        </dt>
                                        <dd className="text-muted-foreground">
                                            Optional:{' '}
                                            <span className="font-mono">
                                                worker
                                            </span>
                                            ,{' '}
                                            <span className="font-mono">
                                                manager
                                            </span>
                                            , or{' '}
                                            <span className="font-mono">
                                                admin
                                            </span>
                                            . Defaults to worker.
                                        </dd>
                                    </div>
                                </dl>
                                <p className="mt-3 text-xs text-muted-foreground">
                                    Rows with an unknown workgroup name fail for
                                    that row. Maximum 500 data rows per import.
                                    Imported users get initial password{' '}
                                    <span className="font-mono text-foreground">
                                        {defaultUserPassword || '—'}
                                    </span>
                                    . Seniority dates and qualifications are not
                                    set by import—edit the user afterward if
                                    needed.
                                </p>
                            </div>
                            {workgroups.length > 0 && (
                                <div className="rounded-md border border-dashed border-sidebar-border/70 px-3 py-2 text-xs text-muted-foreground dark:border-sidebar-border">
                                    <span className="font-medium text-foreground">
                                        Workgroup names in this app:{' '}
                                    </span>
                                    {[...workgroups]
                                        .sort((a, b) =>
                                            a.name.localeCompare(b.name),
                                        )
                                        .map((w) => w.name)
                                        .join(', ')}
                                </div>
                            )}
                            <div>
                                <Label htmlFor="import-file">CSV file</Label>
                                <Input
                                    id="import-file"
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="mt-1 cursor-pointer"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] ?? null;
                                        setImportFile(f);
                                    }}
                                />
                            </div>
                            <div>
                                <Label htmlFor="import-paste">
                                    Or paste CSV
                                </Label>
                                <textarea
                                    id="import-paste"
                                    value={importForm.csv_content}
                                    onChange={(e) =>
                                        setImportForm((f) => ({
                                            ...f,
                                            csv_content: e.target.value,
                                        }))
                                    }
                                    rows={6}
                                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    placeholder={
                                        'name,email,workgroups\nJane Doe,jane@example.com,Dispatch'
                                    }
                                />
                            </div>
                        </div>
                        <DialogFooter className="mt-0 shrink-0 border-t px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setImportOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Import</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteId !== null}
                onOpenChange={(open) => !open && setDeleteId(null)}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete user?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This removes the user and related data (shifts, posts,
                        notifications, etc.). This cannot be undone.
                    </p>
                    {pageErrors?.user && (
                        <p className="text-sm text-destructive">
                            {pageErrors.user}
                        </p>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteId(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={submitDelete}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
