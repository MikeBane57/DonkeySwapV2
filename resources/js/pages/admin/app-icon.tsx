import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ImagePlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/app/admin' },
    { title: 'App icon', href: '/app/admin/app-icon' },
];

type IconItem = { url: string; filename: string };

export default function AdminAppIcon() {
    const props = usePage().props as {
        icons: IconItem[];
        current_icon_url: string;
        flash?: { success?: string; error?: string };
        errors?: Record<string, string>;
    };
    const icons = props.icons ?? [];
    const currentIconUrl = props.current_icon_url ?? '';
    const flash = props.flash;
    const errors = props.errors ?? {};

    const uploadForm = useForm({
        icon: null as File | null,
    });

    function handleUpload(e: React.FormEvent) {
        e.preventDefault();
        if (!uploadForm.data.icon) return;
        uploadForm.post('/app/admin/app-icon', {
            forceFormData: true,
            onSuccess: () => uploadForm.reset(),
        });
    }

    function setCurrent(url: string) {
        router.post('/app/admin/app-icon/set-current', { icon_url: url });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="App icon – Admin" />
            <div className="p-4 space-y-6">
                <h1 className="text-2xl font-semibold">App icon</h1>
                <p className="text-muted-foreground">
                    This icon is used for the in-app home logo, browser tab, and PWA/home screen. Upload a new image or pick one already uploaded.
                </p>

                {flash?.success && (
                    <p className="rounded-md bg-green-500/15 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                        {flash.success}
                    </p>
                )}
                {flash?.error && (
                    <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                        {flash.error}
                    </p>
                )}

                <section className="space-y-3">
                    <h2 className="font-medium">Upload new icon</h2>
                    <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="icon">Image (PNG, JPG, GIF, WebP; max 2MB)</Label>
                            <Input
                                id="icon"
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    uploadForm.setData('icon', file ?? null);
                                }}
                            />
                            {errors.icon && (
                                <p className="text-sm text-destructive">{errors.icon}</p>
                            )}
                        </div>
                        <Button type="submit" disabled={!uploadForm.data.icon}>
                            <ImagePlus className="mr-2 h-4 w-4" />
                            Upload and set as current
                        </Button>
                    </form>
                </section>

                <section className="space-y-3">
                    <h2 className="font-medium">Pick an icon</h2>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {icons.map((icon) => {
                            const isCurrent = icon.url === currentIconUrl;
                            return (
                                <div
                                    key={icon.url}
                                    className={`flex flex-col items-center rounded-xl border p-4 transition-colors ${
                                        isCurrent
                                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                            : 'border-sidebar-border/70 hover:bg-muted/50 dark:border-sidebar-border'
                                    }`}
                                >
                                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-white/10">
                                        <img
                                            src={icon.url}
                                            alt={icon.filename}
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                    <p className="mt-2 truncate w-full text-center text-xs text-muted-foreground" title={icon.filename}>
                                        {icon.filename}
                                    </p>
                                    <Button
                                        type="button"
                                        variant={isCurrent ? 'secondary' : 'outline'}
                                        size="sm"
                                        className="mt-2 w-full"
                                        onClick={() => setCurrent(icon.url)}
                                        disabled={isCurrent}
                                    >
                                        {isCurrent ? (
                                            <>
                                                <Check className="mr-2 h-4 w-4" />
                                                Current
                                            </>
                                        ) : (
                                            'Use this'
                                        )}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}