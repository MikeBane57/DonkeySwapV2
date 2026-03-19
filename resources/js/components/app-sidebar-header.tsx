import { Link, usePage } from '@inertiajs/react';
import { AlertCircle } from 'lucide-react';
import { BadgePermissionBanner } from '@/components/badge-permission-banner';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NotificationsBadge } from '@/components/notifications-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const page = usePage();
    const { auth, pending_reconciliation } = page.props as {
        auth?: { user?: { name: string; avatar?: string } };
        pending_reconciliation?: boolean;
    };
    const getInitials = useInitials();
    const user = auth?.user;

    return (
        <>
            <div className="shrink-0 px-4 pt-2">
                <BadgePermissionBanner />
                {pending_reconciliation && (
                    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        <div className="flex flex-wrap items-center gap-2">
                            <AlertCircle className="size-4 shrink-0" />
                            <span className="min-w-0 flex-1">Your schedule was updated by an admin bulk push. Review and confirm your shifts.</span>
                            <Button variant="outline" size="sm" className="shrink-0" asChild>
                                <Link href="/app/reconcile-schedule">Review changes</Link>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/50 bg-background px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex flex-1 items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <div className="flex items-center gap-2">
                <NotificationsBadge />
                {user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="size-9 rounded-full p-1"
                            >
                                <Avatar className="size-8 overflow-hidden rounded-full">
                                    <AvatarImage
                                        src={user.avatar}
                                        alt={user.name}
                                    />
                                    <AvatarFallback className="rounded-lg bg-muted text-muted-foreground text-sm">
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            <UserMenuContent user={user} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            </header>
        </>
    );
}
