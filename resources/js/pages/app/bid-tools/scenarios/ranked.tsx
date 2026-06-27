import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Compare', href: '#' },
];

type LinePick = {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
    submitted_externally: boolean;
};

type LineFmt = {
    id: number;
    line_num: string;
    desk_group: string;
    source_label: string | null;
    start_time: string;
    rotation: string | null;
    workdays_from_file: number | null;
    workdays_computed: number;
    metrics: {
        holidays_off: number;
        fri_off: number;
        sat_off: number;
        sun_off: number;
        fri_sat_sun_all_off: number;
        sat_sun_both_off: number;
    };
    training_summary: string;
    schedule_callouts: string;
};

type ScoredRow = {
    rank: number;
    bid_line_id: number;
    line_num: string;
    total: number;
    parts: Record<string, number>;
    breakdown: Record<string, unknown>;
    line: LineFmt | null;
    submitted_externally: boolean;
};

export default function BidScenarioRanked({
    scenario,
    lines,
    scored_rows: scoredRows,
}: {
    scenario: {
        id: number;
        name: string;
        vacation_bank: number;
        import_stale: boolean;
    };
    lines: LinePick[];
    scored_rows: ScoredRow[] | null;
}) {
    const [selected, setSelected] = useState<Record<number, boolean>>({});

    const selectedIds = useMemo(
        () =>
            Object.entries(selected)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [selected],
    );

    const [comparing, setComparing] = useState(false);

    const runCompare = () => {
        setComparing(true);
        router.post(
            `/app/bid-tools/scenarios/${scenario.id}/score`,
            { line_ids: selectedIds },
            {
                preserveScroll: true,
                onFinish: () => setComparing(false),
            },
        );
    };

    const toggleSubmitted = (lineId: number, submitted: boolean): void => {
        router.patch(
            `/app/bid-tools/scenarios/${scenario.id}/lines/${lineId}/submitted`,
            { submitted_externally: submitted },
            {
                preserveScroll: true,
                only: ['lines', 'scored_rows'],
            },
        );
    };

    const selectAll = () => {
        const next: Record<number, boolean> = {};
        lines.forEach((l) => {
            next[l.id] = true;
        });
        setSelected(next);
    };

    const clearSelection = () => setSelected({});

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Compare · ${scenario.name}`} />
            <div className="bid-tools-print space-y-6 p-4 pb-12">
                <div className="no-print flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {scenario.name}
                        </h1>
                        {scenario.import_stale && (
                            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                                Master import was replaced after this scenario
                                was created.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/scenarios/${scenario.id}/edit`}
                            >
                                Edit scenario
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => window.print()}
                        >
                            Print
                        </Button>
                    </div>
                </div>

                <section className="no-print space-y-3">
                    <h2 className="text-sm font-medium">Select lines</h2>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={selectAll}
                        >
                            Select all
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearSelection}
                        >
                            Clear
                        </Button>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-sidebar-border/70 p-3">
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {lines.map((l) => (
                                <label
                                    key={l.id}
                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={!!selected[l.id]}
                                        onCheckedChange={(c) =>
                                            setSelected((s) => ({
                                                ...s,
                                                [l.id]: c === true,
                                            }))
                                        }
                                    />
                                    <span className="font-mono">
                                        {l.line_num}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {l.desk_group}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <Button
                        type="button"
                        disabled={selectedIds.length === 0 || comparing}
                        onClick={() => runCompare()}
                    >
                        Compare selected (recommended order)
                    </Button>
                </section>

                {scoredRows && scoredRows.length > 0 && (
                    <section className="space-y-4">
                        <h2 className="text-lg font-semibold print:text-xl">
                            Recommended bid order
                        </h2>
                        <p className="no-print text-sm text-muted-foreground">
                            Based on your scenario weights, priorities, and
                            tie-break order. Lower rank # = better fit.
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                            <table className="w-full min-w-[1280px] text-left text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="no-print w-10 p-2">
                                            Submitted
                                        </th>
                                        <th className="w-12 p-2">#</th>
                                        <th className="p-2">Line</th>
                                        <th className="p-2">Group</th>
                                        <th className="p-2">Source</th>
                                        <th className="p-2">Start</th>
                                        <th className="p-2">Rot</th>
                                        <th className="p-2">WD</th>
                                        <th className="p-2">Hol</th>
                                        <th className="p-2">F/Sa/Su</th>
                                        <th className="max-w-[200px] p-2">
                                            Training (SP/FA)
                                        </th>
                                        <th className="max-w-[320px] p-2">
                                            Callouts
                                        </th>
                                        <th className="p-2">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scoredRows.map((row) => {
                                        const fmt = row.line;
                                        return (
                                            <tr
                                                key={row.bid_line_id}
                                                className="border-b border-sidebar-border/40"
                                            >
                                                <td className="no-print p-2">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            checked={
                                                                row.submitted_externally
                                                            }
                                                            onCheckedChange={(
                                                                c,
                                                            ) => {
                                                                toggleSubmitted(
                                                                    row.bid_line_id,
                                                                    c === true,
                                                                );
                                                            }}
                                                        />
                                                        <Label className="sr-only">
                                                            Submitted externally
                                                        </Label>
                                                    </div>
                                                </td>
                                                <td className="p-2 font-medium">
                                                    {row.rank}
                                                </td>
                                                <td className="p-2 font-mono text-xs">
                                                    {row.line_num}
                                                </td>
                                                <td className="p-2">
                                                    {fmt?.desk_group ?? '—'}
                                                </td>
                                                <td className="max-w-[120px] p-2 text-xs text-muted-foreground">
                                                    {fmt?.source_label ?? '—'}
                                                </td>
                                                <td className="p-2 text-xs">
                                                    {fmt?.start_time ?? '—'}
                                                </td>
                                                <td className="p-2 text-xs">
                                                    {fmt?.rotation ?? '—'}
                                                </td>
                                                <td className="p-2 text-xs">
                                                    {fmt
                                                        ? (fmt.workdays_from_file ??
                                                          fmt.workdays_computed)
                                                        : '—'}
                                                </td>
                                                <td className="p-2">
                                                    {fmt?.metrics
                                                        .holidays_off ?? '—'}
                                                </td>
                                                <td className="p-2 text-xs">
                                                    {fmt ? (
                                                        <>
                                                            {
                                                                fmt.metrics
                                                                    .fri_off
                                                            }
                                                            /
                                                            {
                                                                fmt.metrics
                                                                    .sat_off
                                                            }
                                                            /
                                                            {
                                                                fmt.metrics
                                                                    .sun_off
                                                            }
                                                            <div className="text-muted-foreground">
                                                                F–Su{' '}
                                                                {
                                                                    fmt.metrics
                                                                        .fri_sat_sun_all_off
                                                                }{' '}
                                                                · Sa–Su{' '}
                                                                {
                                                                    fmt.metrics
                                                                        .sat_sun_both_off
                                                                }
                                                            </div>
                                                        </>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="max-w-[220px] p-2 text-xs leading-snug">
                                                    {fmt?.training_summary ??
                                                        '—'}
                                                </td>
                                                <td className="max-w-[320px] p-2 text-xs leading-snug text-muted-foreground whitespace-pre-wrap">
                                                    {fmt?.schedule_callouts ??
                                                        '—'}
                                                </td>
                                                <td className="p-2 font-medium whitespace-nowrap">
                                                    {row.total}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                <style>{`
                    @media print {
                        .no-print { display: none !important; }
                        .bid-tools-print { padding: 0; }
                    }
                `}</style>
            </div>
        </AppLayout>
    );
}
