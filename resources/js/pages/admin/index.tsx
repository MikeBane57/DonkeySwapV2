import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    FileSpreadsheet,
    ImageIcon,
    ListOrdered,
    MessageSquare,
    MonitorSmartphone,
    Send,
    Users,
    Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Admin', href: '/app/admin' }];

type AdminModule = {
    title: string;
    href: string;
    description: string;
    icon: LucideIcon;
};

type AdminSection = {
    title: string;
    blurb?: string;
    items: AdminModule[];
};

const sections: AdminSection[] = [
    {
        title: 'Insights',
        blurb: 'Trends and historical metrics for swap activity and scheduling.',
        items: [
            {
                title: 'Analytics',
                href: '/app/admin/analytics',
                description:
                    'Swap and LFW activity, resolution times, offers, shift-date heatmaps, rolling week stats, and user activity (persisted daily snapshots plus live queries).',
                icon: BarChart3,
            },
            {
                title: 'Active sessions',
                href: '/app/admin/active-sessions',
                description:
                    'Who is signed in right now: browser vs installed app, OS, and last activity (from database sessions).',
                icon: MonitorSmartphone,
            },
        ],
    },
    {
        title: 'People & access',
        blurb: 'Who can use the app and how they are grouped.',
        items: [
            {
                title: 'User Manager',
                href: '/app/admin/users',
                description:
                    'Add or remove users, assign workgroups, qualifications, and seniority dates.',
                icon: Users,
            },
            {
                title: 'Workgroup Manager',
                href: '/app/admin/workgroups',
                description:
                    'Create workgroups, desk types, hours limits, rest rules, and allowed start times.',
                icon: Workflow,
            },
        ],
    },
    {
        title: 'Scheduling',
        blurb: 'Shifts on the board and red-line ordering.',
        items: [
            {
                title: 'Shift Manager',
                href: '/app/admin/shifts',
                description:
                    'Add, move, bulk edit, or remove shifts for any user; add by rotation.',
                icon: CalendarDays,
            },
            {
                title: 'Red Line Editor',
                href: '/app/admin/red-lines',
                description:
                    'Set red line position, lock above-line members, and sort below the line.',
                icon: ListOrdered,
            },
        ],
    },
    {
        title: 'Posts & trading',
        blurb: 'Moderation and visibility for swap posts and offers.',
        items: [
            {
                title: 'Post Manager',
                href: '/app/admin/posts',
                description:
                    'Filter and manage swap posts: status, views, history, offers, and responses.',
                icon: FileSpreadsheet,
            },
        ],
    },
    {
        title: 'Communications',
        blurb: 'Reach users in-app via banners or the notification bell.',
        items: [
            {
                title: 'Message Center',
                href: '/app/admin/message-center',
                description:
                    'Banner messages (acknowledge) and bell notifications by audience or batch.',
                icon: MessageSquare,
            },
        ],
    },
    {
        title: 'Schedule imports',
        blurb: 'CSV imports from scheduling systems and data cleanup.',
        items: [
            {
                title: 'Import Audit',
                href: '/app/admin/import-history',
                description:
                    'Import runs, compare to board, bulk apply extended schedule CSVs.',
                icon: Send,
            },
            {
                title: 'Import Unmapped Codes',
                href: '/app/admin/import-unmapped-codes',
                description:
                    'Desk or time codes seen in imports that do not match workgroup position ranges.',
                icon: AlertTriangle,
            },
        ],
    },
    {
        title: 'Branding',
        blurb: 'How the app looks in the browser and when installed.',
        items: [
            {
                title: 'App icon',
                href: '/app/admin/app-icon',
                description:
                    'Upload or choose the logo, favicon, and PWA icon.',
                icon: ImageIcon,
            },
        ],
    },
];

function AdminCard({ item }: { item: AdminModule }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            className={cn(
                'group flex gap-4 rounded-xl border border-sidebar-border/70 p-4 transition-colors',
                'hover:border-sidebar-border hover:bg-muted/50 dark:border-sidebar-border',
            )}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground group-hover:bg-muted group-hover:text-foreground">
                <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="leading-tight font-medium">{item.title}</h3>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                    {item.description}
                </p>
            </div>
        </Link>
    );
}

export default function AdminIndex() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Admin" />
            <div className="p-4 pb-10">
                <div className="max-w-5xl space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Admin
                    </h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Tools for analytics, users, scheduling, posts,
                        messaging, imports, and branding. Pick a section below.
                    </p>
                </div>

                <div className="mt-10 max-w-5xl space-y-10">
                    {sections.map((section) => (
                        <section key={section.title} className="space-y-3">
                            <div className="border-b border-sidebar-border/60 pb-2 dark:border-sidebar-border/80">
                                <h2 className="text-base font-semibold text-foreground">
                                    {section.title}
                                </h2>
                                {section.blurb && (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {section.blurb}
                                    </p>
                                )}
                            </div>
                            <div
                                className={cn(
                                    'grid gap-3',
                                    section.items.length > 1
                                        ? 'sm:grid-cols-2'
                                        : 'grid-cols-1',
                                )}
                            >
                                {section.items.map((item) => (
                                    <AdminCard key={item.href} item={item} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
