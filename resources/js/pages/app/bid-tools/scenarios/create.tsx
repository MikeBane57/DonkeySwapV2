import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
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
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'New scenario', href: '/app/bid-tools/scenarios/create' },
];

export default function BidScenarioCreate({
    imports,
}: {
    imports: { id: number; bid_year: number; file_hash: string }[];
}) {
    const { data, setData, post, processing, errors } = useForm({
        bid_import_id: imports[0]?.id ?? 0,
        name: 'My scenario',
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New bid scenario" />
            <div className="mx-auto max-w-lg space-y-6 p-4 pb-12">
                <h1 className="text-2xl font-semibold tracking-tight">
                    New scenario
                </h1>
                {imports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No master import available. An admin must upload bid
                        lines first.
                    </p>
                ) : (
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            post('/app/bid-tools/scenarios');
                        }}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="bid_import_id">
                                Bid year / file
                            </Label>
                            <Select
                                value={String(data.bid_import_id)}
                                onValueChange={(v) =>
                                    setData('bid_import_id', Number(v))
                                }
                            >
                                <SelectTrigger id="bid_import_id">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {imports.map((i) => (
                                        <SelectItem
                                            key={i.id}
                                            value={String(i.id)}
                                        >
                                            {i.bid_year} ·{' '}
                                            {i.file_hash.slice(0, 8)}…
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.bid_import_id && (
                                <p className="text-sm text-destructive">
                                    {errors.bid_import_id}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                            />
                            {errors.name && (
                                <p className="text-sm text-destructive">
                                    {errors.name}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" disabled={processing}>
                                Create
                            </Button>
                            <Button variant="outline" type="button" asChild>
                                <Link href="/app/bid-tools">Cancel</Link>
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </AppLayout>
    );
}
