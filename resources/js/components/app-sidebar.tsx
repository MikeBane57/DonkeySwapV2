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
    },
    {
        title: 'Available shifts',
        href: '/app/available',
        icon: ClipboardList,
    },
    {
        title: 'Looking for work',
        href: '/app/looking-for-work',
        icon: Briefcase,
    },
];

const adminNavItems: NavItem[] = [
    { title: 'Admin Panel', href: '/app/admin', icon: Shield },
];

export function AppSidebar() {
    const { auth } = usePage().props as { auth?: { user?: { role?: string } } };
    const isAdmin = auth?.user?.role === 'admin';

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="border-sidebar-border/50 border-b pb-3">
                <Link href={dashboard()} prefetch className="block outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-md">
                    <AppLogo />
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} groupLabel="Manage your schedule" />
                {isAdmin && (
                    <NavMain items={adminNavItems} groupLabel="Administration" />
                )}
            </SidebarContent>
        </Sidebar>
    );
}
