import { Link, usePage } from '@inertiajs/react';
import {
    Briefcase,
    CalendarSync,
    ClipboardList,
    ListOrdered,
    Shield,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
} from '@/components/ui/sidebar';
import { dashboard, othersBoards } from '@/routes';
import type { NavItem } from '@/types';

function buildMainNavItems(bidToolsEnabled: boolean): NavItem[] {
    const items: NavItem[] = [
        {
            title: 'My Schedule',
            href: dashboard(),
            icon: CalendarSync,
            dataTour: 'nav-my-schedule',
        },
        {
            title: "Others' boards",
            href: othersBoards(),
            icon: Users,
            dataTour: 'nav-others-boards',
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
    if (bidToolsEnabled) {
        items.push({
            title: 'Bid tools',
            href: '/app/bid-tools',
            icon: ListOrdered,
            dataTour: 'nav-bid-tools',
        });
    }

    return items;
}

const adminNavItems: NavItem[] = [
    {
        title: 'Admin Panel',
        href: '/app/admin',
        icon: Shield,
        dataTour: 'nav-admin',
    },
];

export function AppSidebar() {
    const { auth, features } = usePage().props as {
        auth?: { user?: { role?: string } };
        features?: { bid_tools?: boolean };
    };
    const isAdmin = auth?.user?.role === 'admin';
    const mainNavItems = buildMainNavItems(!!features?.bid_tools);

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
