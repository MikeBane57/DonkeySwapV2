import { Head, Link, router, usePage } from '@inertiajs/react';
import { Copy, Play, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
];

type SimulationRow = {
    id: number;
    name: string;
    bid_year: number;
    participants_count: number;
    last_run_at: string | null;
    updated_at: string;
};

export default function BidSimulationsIndex({
    simulations,
}: {
    simulations: SimulationRow[];
}) {
    const page = usePage<{ flash?: { success?: string; error?: string } }>();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bid simulator" />
            <div className="mx-auto max-w-3xl space-y-6 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Bid simulator
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Model a seniority bid: assign preference profiles to
                            each bidder, get recommended line orders, and see
                            who would pick what.
                        </p>
                    </div>
                    <Button size="sm" asChild>
                        <Link href="/app/bid-tools/simulations/create">
                            <Plus className="mr-2 h-4 w-4" />
                            New simulation
                        </Link>
                    </Button>
                </div>

                {page.props.flash?.success && (
                    <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                        {page.props.flash.success}
                    </p>
                )}
                {page.props.flash?.error && (
                    <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
                        {page.props.flash.error}
                    </p>
                )}

                {simulations.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No simulations yet. Create one, add bidders with
                        seniority order and preference profiles (scenarios),
                        then run the simulator.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {simulations.map((s) => (
                            <li
                                key={s.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border/70 p-3"
                            >
                                <div>
                                    <div className="font-medium">{s.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        Bid {s.bid_year} ·{' '}
                                        <Users className="mr-1 inline h-3.5 w-3.5" />
                                        {s.participants_count} bidder
                                        {s.participants_count === 1 ? '' : 's'}
                                        {s.last_run_at && (
                                            <span>
                                                {' '}
                                                · last run{' '}
                                                {new Date(
                                                    s.last_run_at,
                                                ).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={`/app/bid-tools/simulations/${s.id}/edit`}
                                        >
                                            Manage
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        type="button"
                                        onClick={() =>
                                            router.post(
                                                `/app/bid-tools/simulations/${s.id}/duplicate`,
                                            )
                                        }
                                    >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Duplicate
                                    </Button>
                                    <Button size="sm" asChild>
                                        <Link
                                            href={`/app/bid-tools/simulations/${s.id}`}
                                        >
                                            <Play className="mr-2 h-4 w-4" />
                                            View
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        type="button"
                                        className="text-muted-foreground hover:text-destructive"
                                        aria-label={`Delete ${s.name}`}
                                        onClick={() => {
                                            if (
                                                confirm(
                                                    `Delete "${s.name}" and all its bidders? This cannot be undone.`,
                                                )
                                            ) {
                                                router.delete(
                                                    `/app/bid-tools/simulations/${s.id}`,
                                                );
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </AppLayout>
    );
}
