import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
];

const modules = [
    { title: 'User Manager', href: '/app/admin/users', description: 'Add/remove users, assign workgroups, set dispatch qualification and seniority dates' },
    { title: 'Workgroup Manager', href: '/app/admin/workgroups', description: 'Create workgroups, set regulatory flag, max hours, rest hours, allowed start times' },
    { title: 'Shift Manager', href: '/app/admin/shifts', description: 'Add, remove, or move shifts for any user; bulk delete or reassign; add by rotation' },
    { title: 'Red Line Editor', href: '/app/admin/red-lines', description: 'Set red line position, lock above-line members, auto-sort below-line' },
    { title: 'Post Manager', href: '/app/admin/posts', description: 'View, filter, sort, activate/deactivate or remove swap posts; see views, clicks, history, offers and responses' },
    { title: 'Message Center', href: '/app/admin/message-center', description: 'Send banner messages (dashboard top, must be acknowledged) or notifications (bell only) to all users, a workgroup, or individuals' },
    { title: 'App icon', href: '/app/admin/app-icon', description: 'Upload or pick the app icon used for the home logo, favicon, and PWA icon' },
    { title: 'Import Audit', href: '/app/admin/import-history', description: 'Import history and run audit, compare run to board, Bulk CSV (extended schedule from Workzone)' },
    { title: 'Import Unmapped Codes', href: '/app/admin/import-unmapped-codes', description: 'Desk/time codes seen in CSV imports that are not in workgroup position ranges' },
];

export default function AdminIndex() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Admin" />
            <div className="p-4 space-y-6">
                <h1 className="text-2xl font-semibold">Admin Panel</h1>
                <div className="grid gap-4 md:grid-cols-2">
                    {modules.map((m) => (
                        <Link
                            key={m.href}
                            href={m.href}
                            className="block rounded-xl border border-sidebar-border/70 p-4 transition-colors hover:bg-muted/50 dark:border-sidebar-border"
                        >
                            <h2 className="font-medium">{m.title}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
