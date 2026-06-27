import { Head, Link, router, usePage } from '@inertiajs/react';
import { ListOrdered, Play, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type Participant = {
    id: number;
    display_name: string;
    seniority_rank: number;
    minimum_bid_lines: number;
    scenario_name: string | null;
};

type ResultRow = {
    participant_id: number;
    display_name: string;
    seniority_rank: number;
    bid_line_id: number | null;
    line_num: string | null;
    desk_group: string | null;
    start_time: string | null;
    preference_rank: number | null;
    total: number | null;
    message: string | null;
};

export default function BidSimulationShow({
    simulation,
    participants,
    results,
}: {
    simulation: {
        id: number;
        name: string;
        bid_year: number;
        import_title: string | null;
        last_run_at: string | null;
    };
    participants: Participant[];
    results: ResultRow[] | null;
}) {
    const page = usePage<{ flash?: { success?: string; error?: string } }>();
    const [running, setRunning] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
        { title: simulation.name, href: '#' },
    ];

    const runSimulation = () => {
        setRunning(true);
        router.post(
            `/app/bid-tools/simulations/${simulation.id}/run`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setRunning(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={simulation.name} />
            <div className="mx-auto max-w-4xl space-y-8 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {simulation.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Bid {simulation.bid_year}
                            {simulation.import_title
                                ? ` · ${simulation.import_title}`
                                : ''}
                            {simulation.last_run_at && (
                                <span>
                                    {' '}
                                    · simulated{' '}
                                    {new Date(
                                        simulation.last_run_at,
                                    ).toLocaleString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/simulations/${simulation.id}/edit`}
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Manage bidders
                            </Link>
                        </Button>
                        <Button
                            size="sm"
                            type="button"
                            disabled={participants.length === 0 || running}
                            onClick={runSimulation}
                        >
                            <Play className="mr-2 h-4 w-4" />
                            Run simulation
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => {
                                if (
                                    confirm(
                                        `Delete "${simulation.name}" and all its bidders? This cannot be undone.`,
                                    )
                                ) {
                                    router.delete(
                                        `/app/bid-tools/simulations/${simulation.id}`,
                                    );
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
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

                <section className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Bidders & recommended orders
                    </h2>
                    {participants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Add bidders in Manage before running.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {participants.map((p) => (
                                <li
                                    key={p.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sidebar-border/70 p-3 text-sm"
                                >
                                    <div>
                                        <span className="font-medium">
                                            #{p.seniority_rank} {p.display_name}
                                        </span>
                                        <span className="ml-2 text-muted-foreground">
                                            rank min {p.minimum_bid_lines} line
                                            {p.minimum_bid_lines === 1
                                                ? ''
                                                : 's'}
                                            {p.scenario_name && (
                                                <span>
                                                    {' '}
                                                    · {p.scenario_name}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={`/app/bid-tools/simulations/${simulation.id}/participants/${p.id}/recommendations`}
                                        >
                                            <ListOrdered className="mr-2 h-4 w-4" />
                                            Suggested bid order
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {results && results.length > 0 && (
                    <section className="space-y-4">
                        <h2 className="text-lg font-semibold">
                            Simulation results
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Each bidder picks their top available line in
                            seniority order.
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                            <table className="w-full min-w-[640px] text-left text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-2">#</th>
                                        <th className="p-2">Bidder</th>
                                        <th className="p-2">Gets line</th>
                                        <th className="p-2">Group</th>
                                        <th className="p-2">Start</th>
                                        <th className="p-2">Pref #</th>
                                        <th className="p-2">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row) => (
                                        <tr
                                            key={row.participant_id}
                                            className="border-b border-sidebar-border/40"
                                        >
                                            <td className="p-2 font-medium">
                                                {row.seniority_rank}
                                            </td>
                                            <td className="p-2">
                                                {row.display_name}
                                            </td>
                                            <td className="p-2 font-mono text-xs">
                                                {row.line_num ?? (
                                                    <span className="text-muted-foreground">
                                                        {row.message ?? '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2">
                                                {row.desk_group ?? '—'}
                                            </td>
                                            <td className="p-2 text-xs">
                                                {row.start_time ?? '—'}
                                            </td>
                                            <td className="p-2">
                                                {row.preference_rank ?? '—'}
                                            </td>
                                            <td className="p-2">
                                                {row.total ?? '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        </AppLayout>
    );
}
