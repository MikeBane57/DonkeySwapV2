import { usePage } from '@inertiajs/react';

const DEFAULT_LOGO = '/images/donkey-swap-logo.png';
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '2.1.33a';

export default function AppLogo() {
    const logoUrl =
        (usePage().props as { app_icon_url?: string }).app_icon_url ??
        DEFAULT_LOGO;
    return (
        <div className="flex items-start gap-3">
            <div className="flex aspect-square size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-white/10">
                <img
                    src={logoUrl}
                    alt="DonkeySwap"
                    className="h-full w-full object-contain"
                />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sidebar-primary">
                    Donkey swap
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    v{APP_VERSION}
                </p>
            </div>
        </div>
    );
}
