import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BidToolsPrintStyles } from '@/pages/app/bid-tools/bid-tools-print-styles';
import type { BreadcrumbItem } from '@/types';

type RecRow = {
    rank: number;
    bid_line_id: number;
    line_num: string;
    total: number;
    minimum_required: boolean;
    desk_group: string | null;
    start_time: string | null;
    holidays_off: number | null;
};

export default function BidSimulationRecommendations({
    simulation,
    participant,
    minimum_depth,
    rows,
}: {
    simulation: {
        id: number;
        name: string;
        bid_year: number;
    };
    participant: {
        id: number;
        display_name: string;
        seniority_rank: number;
        minimum_bid_lines: number;
        scenario_name: string | null;
    };
    minimum_depth: number;
    rows: RecRow[];
}) {
    const printedAt = new Date().toLocaleString();
    const requiredRows = rows.filter((r) => r.minimum_required);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Bid tools', href: '/app/bid-tools' },
        { title: 'Bid simulator', href: '/app/bid-tools/simulations' },
        {
            title: simulation.name,
            href: `/app/bid-tools/simulations/${simulation.id}`,
        },
        { title: participant.display_name, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head
                title={`Bid order · ${participant.display_name}`}
            />
            <div className="bid-tools-print space-y-6 p-4 pb-12">
                <div className="no-print flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Suggested bid order
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            #{participant.seniority_rank}{' '}
                            {participant.display_name} · bid {simulation.bid_year}
                            {participant.scenario_name && (
                                <span> · {participant.scenario_name}</span>
                            )}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Must rank at least{' '}
                            <strong>{minimum_depth}</strong> line
                            {minimum_depth === 1 ? '' : 's'} (through #
                            {minimum_depth}).
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => window.print()}
                        >
                            Print bid order
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/simulations/${simulation.id}`}
                            >
                                Back
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="print-only">
                    <h2 className="bid-tools-print-title">
                        {participant.display_name} — suggested bid order
                    </h2>
                    <p className="bid-tools-print-subtitle">
                        Seniority #{participant.seniority_rank} · min{' '}
                        {minimum_depth} line{minimum_depth === 1 ? '' : 's'} ·{' '}
                        {simulation.name} · bid {simulation.bid_year}
                    </p>
                    <p className="bid-tools-print-subtitle">{printedAt}</p>
                </div>

                <section className="no-print space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                        Minimum bid sheet depth: {minimum_depth} lines
                    </p>
                    <p className="text-amber-800 dark:text-amber-200">
                        Lines highlighted below are your top {minimum_depth}{' '}
                        choices — the minimum you should submit at seniority #
                        {participant.seniority_rank}.
                    </p>
                </section>

                <div className="print-only overflow-x-auto">
                    <table className="bid-tools-print-table w-full text-left">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Line</th>
                                <th>Grp</th>
                                <th>Start</th>
                                <th>Hol</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requiredRows.map((row) => (
                                <tr key={row.bid_line_id}>
                                    <td>{row.rank}</td>
                                    <td className="font-mono">{row.line_num}</td>
                                    <td>{row.desk_group ?? '—'}</td>
                                    <td>{row.start_time ?? '—'}</td>
                                    <td>{row.holidays_off ?? '—'}</td>
                                    <td>{row.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length > requiredRows.length && (
                        <p className="bid-tools-print-subtitle mt-2">
                            +{rows.length - requiredRows.length} additional
                            ranked lines on screen view
                        </p>
                    )}
                </div>

                <div className="no-print overflow-x-auto rounded-lg border border-sidebar-border/70">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2">#</th>
                                <th className="p-2">Line</th>
                                <th className="p-2">Group</th>
                                <th className="p-2">Start</th>
                                <th className="p-2">Hol</th>
                                <th className="p-2">Score</th>
                                <th className="p-2">Min bid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.bid_line_id}
                                    className={
                                        row.minimum_required
                                            ? 'border-b border-sidebar-border/40 bg-amber-500/10'
                                            : 'border-b border-sidebar-border/40'
                                    }
                                >
                                    <td className="p-2 font-medium">
                                        {row.rank}
                                    </td>
                                    <td className="p-2 font-mono text-xs">
                                        {row.line_num}
                                    </td>
                                    <td className="p-2">
                                        {row.desk_group ?? '—'}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {row.start_time ?? '—'}
                                    </td>
                                    <td className="p-2">
                                        {row.holidays_off ?? '—'}
                                    </td>
                                    <td className="p-2">{row.total}</td>
                                    <td className="p-2 text-xs">
                                        {row.minimum_required ? 'Required' : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <BidToolsPrintStyles />
            </div>
        </AppLayout>
    );
}
