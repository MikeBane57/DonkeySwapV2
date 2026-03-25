import { Link, usePage } from '@inertiajs/react';
import { Briefcase, CalendarSync, ClipboardList, Shield } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'My Schedule',
        href: dashboard(),
        icon: CalendarSync,
        dataTour: 'nav-my-schedule',
    },
    {
        title: 'Available shifts',
        href: '/app/available',
        icon: ClipboardList,
        dataTour: 'nav-available',
    },
    {
        title: 'Looking for work',
        href: '/app/looking-for-work',
        icon: Briefcase,
        dataTour: 'nav-looking-for-work',
    },
];

const adminNavItems: NavItem[] = [
    {
        title: 'Admin Panel',
        href: '/app/admin',
        icon: Shield,
        dataTour: 'nav-admin',
    },
];

export function AppSidebar() {
    const { auth } = usePage().props as { auth?: { user?: { role?: string } } };
    const isAdmin = auth?.user?.role === 'admin';

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="border-b border-sidebar-border/50 pb-3">
                <Link
                    href={dashboard()}
                    prefetch
                    className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                    <AppLogo />
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <div data-tour="sidebar-nav">
                    <NavMain
                        items={mainNavItems}
                        groupLabel="Manage your schedule"
                    />
                    {isAdmin && (
                        <NavMain
                            items={adminNavItems}
                            groupLabel="Administration"
                        />
                    )}
                </div>
            </SidebarContent>
        </Sidebar>
    );
}
