import { Head, Link, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Compare scenarios', href: '#' },
];

const CRITERIA_LABELS: Record<string, string> = {
    holiday: 'Hol',
    personal: 'Per',
    start_time: 'Start',
    desk: 'Desk',
};

type ScenarioOption = {
    id: number;
    name: string;
    bid_import_id: number;
    bid_year: number;
    vacation_bank: number;
    criteria_order: string[];
    import_stale: boolean;
};

type LinePick = {
    id: number;
    line_num: string;
    desk_group: string;
    start_time: string;
};

type LineFmt = {
    desk_group: string;
    start_time: string;
    schedule_callouts: string;
    metrics: {
        holidays_off: number;
        fri_off: number;
        sat_off: number;
        sun_off: number;
    };
};

type CompareRow = {
    bid_line_id: number;
    line_num: string;
    rank_a: number;
    rank_b: number;
    rank_delta: number;
    total_a: number;
    total_b: number;
    total_delta: number;
    parts_a: Record<string, number>;
    parts_b: Record<string, number>;
    line: LineFmt | null;
};

type ScenarioSummary = {
    id: number;
    name: string;
    bid_year: number;
    vacation_bank: number;
    weights: Record<string, number>;
    criteria_order: string[];
    import_stale: boolean;
};

function formatDelta(value: number): string {
    if (value === 0) {
        return '0';
    }
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}`;
}

function deltaClass(value: number, invert = false): string {
    if (value === 0) {
        return 'text-muted-foreground';
    }
    const improved = invert ? value < 0 : value > 0;
    return improved
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-rose-700 dark:text-rose-300';
}

function CompareSetup({
    scenarios,
    lines,
    prefill,
}: {
    scenarios: ScenarioOption[];
    lines: LinePick[];
    prefill: {
        scenario_a_id: number | null;
        scenario_b_id: number | null;
        line_ids: number[];
    };
}) {
    const [scenarioAId, setScenarioAId] = useState<number | ''>(
        prefill.scenario_a_id ?? '',
    );
    const [scenarioBId, setScenarioBId] = useState<number | ''>(
        prefill.scenario_b_id ?? '',
    );
    const [selected, setSelected] = useState<Record<number, boolean>>(() => {
        const next: Record<number, boolean> = {};
        prefill.line_ids.forEach((id) => {
            next[id] = true;
        });
        return next;
    });
    const [comparing, setComparing] = useState(false);

    const scenarioA = useMemo(
        () => scenarios.find((s) => s.id === scenarioAId) ?? null,
        [scenarios, scenarioAId],
    );

    const scenarioBOptions = useMemo(() => {
        if (!scenarioA) {
            return scenarios;
        }

        return scenarios.filter(
            (s) =>
                s.bid_import_id === scenarioA.bid_import_id &&
                s.id !== scenarioA.id,
        );
    }, [scenarios, scenarioA]);

    const selectedIds = useMemo(
        () =>
            Object.entries(selected)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [selected],
    );

    const onScenarioAChange = (value: string) => {
        const id = value === '' ? '' : Number(value);
        setScenarioAId(id);
        setScenarioBId('');
        if (id !== '') {
            router.get(
                '/app/bid-tools/scenarios/compare',
                { scenario_a: id },
                { preserveScroll: true, preserveState: false },
            );
        }
    };

    const runCompare = () => {
        if (scenarioAId === '' || scenarioBId === '') {
            return;
        }
        setComparing(true);
        router.post(
            '/app/bid-tools/scenarios/compare',
            {
                scenario_a_id: scenarioAId,
                scenario_b_id: scenarioBId,
                line_ids: selectedIds,
            },
            {
                preserveScroll: true,
                onFinish: () => setComparing(false),
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
        <>
            <section className="no-print space-y-4 rounded-lg border border-sidebar-border/70 p-4">
                        <h2 className="text-sm font-medium">Scenarios</h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="scenario-a">Scenario A</Label>
                                <select
                                    id="scenario-a"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                    value={scenarioAId === '' ? '' : String(scenarioAId)}
                                    onChange={(e) => onScenarioAChange(e.target.value)}
                                >
                                    <option value="">Select scenario…</option>
                                    {scenarios.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} (bid {s.bid_year})
                                            {s.import_stale ? ' · stale' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scenario-b">Scenario B</Label>
                                <select
                                    id="scenario-b"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                    value={scenarioBId === '' ? '' : String(scenarioBId)}
                                    onChange={(e) =>
                                        setScenarioBId(
                                            e.target.value === ''
                                                ? ''
                                                : Number(e.target.value),
                                        )
                                    }
                                    disabled={scenarioAId === ''}
                                >
                                    <option value="">Select scenario…</option>
                                    {scenarioBOptions.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} (bid {s.bid_year})
                                            {s.import_stale ? ' · stale' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {scenarioA && scenarioBId !== '' && (
                            <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                                {[scenarioA, scenarios.find((s) => s.id === scenarioBId)].map(
                                    (s) =>
                                        s ? (
                                            <div
                                                key={s.id}
                                                className="rounded-md bg-muted/40 px-3 py-2"
                                            >
                                                <div className="font-medium text-foreground">
                                                    {s.name}
                                                </div>
                                                <div>
                                                    Vacation bank {s.vacation_bank}
                                                    {' · '}
                                                    Tie-break:{' '}
                                                    {s.criteria_order
                                                        .map((c) => CRITERIA_LABELS[c] ?? c)
                                                        .join(' → ')}
                                                </div>
                                            </div>
                                        ) : null,
                                )}
                            </div>
                        )}
            </section>

            {lines.length > 0 && (
                <section className="no-print space-y-3">
                        <h2 className="text-sm font-medium">Lines to compare</h2>
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
                                        <span className="font-mono">{l.line_num}</span>
                                        <span className="text-muted-foreground">
                                            {l.desk_group}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <Button
                            type="button"
                            disabled={
                                scenarioAId === ''
                                || scenarioBId === ''
                                || selectedIds.length === 0
                                || comparing
                            }
                            onClick={runCompare}
                        >
                            Compare scenarios
                        </Button>
                </section>
            )}
        </>
    );
}

function ComparisonResults({
    comparison,
    scenarios,
    prefill,
}: {
    comparison: {
        scenario_a: ScenarioSummary;
        scenario_b: ScenarioSummary;
        rows: CompareRow[];
    };
    scenarios: ScenarioOption[];
    prefill: {
        scenario_b_id: number | null;
    };
}) {
    const nameA = comparison.scenario_a.name;
    const nameB = comparison.scenario_b.name
        ?? scenarios.find((s) => s.id === prefill.scenario_b_id)?.name
        ?? 'Scenario B';

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg font-semibold print:text-xl">
                                Side-by-side results
                            </h2>
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className="no-print"
                                onClick={() => window.print()}
                            >
                                Print
                            </Button>
            </div>
            <p className="no-print text-sm text-muted-foreground">
                Rank #1 is best fit. Positive rank delta means the
                line ranks worse in {nameB}. Positive score delta
                means a higher total in {nameB}.
            </p>
            <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="p-2">Line</th>
                            <th className="p-2">Group</th>
                            <th className="p-2">Start</th>
                            <th className="p-2">#{nameA}</th>
                            <th className="p-2">#{nameB}</th>
                            <th className="p-2">Rank Δ</th>
                            <th className="p-2">Score A</th>
                            <th className="p-2">Score B</th>
                            <th className="p-2">Score Δ</th>
                            <th className="max-w-[280px] p-2">Callouts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {comparison.rows.map((row) => {
                            const fmt = row.line;
                            return (
                                <tr
                                    key={row.bid_line_id}
                                    className="border-b border-sidebar-border/40"
                                >
                                    <td className="p-2 font-mono text-xs">
                                        {row.line_num}
                                    </td>
                                    <td className="p-2">
                                        {fmt?.desk_group ?? '—'}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {fmt?.start_time ?? '—'}
                                    </td>
                                    <td className="p-2 font-medium">
                                        {row.rank_a}
                                    </td>
                                    <td className="p-2 font-medium">
                                        {row.rank_b}
                                    </td>
                                    <td
                                        className={`p-2 font-medium ${deltaClass(row.rank_delta, true)}`}
                                    >
                                        {formatDelta(row.rank_delta)}
                                    </td>
                                    <td className="p-2">{row.total_a}</td>
                                    <td className="p-2">{row.total_b}</td>
                                    <td
                                        className={`p-2 font-medium ${deltaClass(row.total_delta)}`}
                                    >
                                        {formatDelta(row.total_delta)}
                                    </td>
                                    <td className="max-w-[280px] p-2 text-xs leading-snug text-muted-foreground whitespace-pre-wrap">
                                        {fmt?.schedule_callouts ?? '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default function BidScenarioCompare({
    scenarios,
    lines,
    comparison,
    prefill,
}: {
    scenarios: ScenarioOption[];
    lines: LinePick[];
    comparison: {
        scenario_a: ScenarioSummary;
        scenario_b: ScenarioSummary;
        rows: CompareRow[];
    } | null;
    prefill: {
        scenario_a_id: number | null;
        scenario_b_id: number | null;
        line_ids: number[];
    };
}) {
    const page = usePage<{ flash?: { error?: string } }>();
    const flashError = page.props.flash?.error;
    const formKey = [
        prefill.scenario_a_id ?? '',
        prefill.scenario_b_id ?? '',
        prefill.line_ids.join(','),
    ].join('-');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Compare scenarios" />
            <div className="bid-tools-print space-y-6 p-4 pb-12">
                <div className="no-print flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Compare scenarios
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Score the same bid lines under two preference profiles
                            and see how ranks and totals shift.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/app/bid-tools">Back to bid tools</Link>
                    </Button>
                </div>

                {flashError && (
                    <p className="no-print rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
                        {flashError}
                    </p>
                )}

                {scenarios.length < 2 && (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Create at least two scenarios on the same master import to
                        compare them.
                    </p>
                )}

                {scenarios.length >= 2 && (
                    <CompareSetup
                        key={formKey}
                        scenarios={scenarios}
                        lines={lines}
                        prefill={prefill}
                    />
                )}

                {comparison && comparison.rows.length > 0 && (
                    <ComparisonResults
                        comparison={comparison}
                        scenarios={scenarios}
                        prefill={prefill}
                    />
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
