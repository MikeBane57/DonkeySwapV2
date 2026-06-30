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
    { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
    { title: 'New', href: '#' },
];

export default function BidSimulationCreate({
    imports,
}: {
    imports: {
        id: number;
        bid_year: number;
        title: string | null;
        original_filename: string;
    }[];
}) {
    const { data, setData, post, processing, errors } = useForm({
        bid_import_id: imports[0]?.id ?? 0,
        name: 'Bid simulation',
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New bid simulation" />
            <div className="mx-auto max-w-lg space-y-6 p-4 pb-12">
                <h1 className="text-2xl font-semibold tracking-tight">
                    New bid simulation
                </h1>
                <p className="text-sm text-muted-foreground">
                    Pick the master line import, then add bidders with seniority
                    rank and a preference profile (scenario) for each person.
                </p>
                {imports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No master import available.
                    </p>
                ) : (
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            post('/app/bid-tools/simulations');
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
                                            {i.bid_year}
                                            {i.title ? ` · ${i.title}` : ''}
                                            {' · '}
                                            {i.original_filename}
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
                            <Label htmlFor="name">Simulation name</Label>
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
                                <Link href="/app/bid-tools/simulations">
                                    Cancel
                                </Link>
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </AppLayout>
    );
}
