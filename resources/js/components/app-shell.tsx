import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { AppBadge } from '@/components/app-badge';
import { SidebarProvider } from '@/components/ui/sidebar';
import { usePushSubscription } from '@/hooks/use-push-subscription';

type Props = {
    children: ReactNode;
    variant?: 'header' | 'sidebar';
};

export function AppShell({ children, variant = 'header' }: Props) {
    const isOpen = usePage().props.sidebarOpen;
    usePushSubscription();

    if (variant === 'header') {
        return (
            <div className="flex min-h-screen w-full flex-col">
                <AppBadge />
                {children}
            </div>
        );
    }

    return (
        <SidebarProvider defaultOpen={isOpen}>
            <AppBadge />
            {children}
        </SidebarProvider>
    );
}
