import { Head, Link, router, usePage } from '@inertiajs/react';
import { Fragment, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import {
    BidLinePickerToolbar,
    type LinePickerRow,
} from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import { BidToolsPrintStyles } from '@/pages/app/bid-tools/bid-tools-print-styles';
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

type LinePick = LinePickerRow;

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

type ScenarioScore = {
    scenario_id: number;
    rank: number;
    total: number;
    parts: Record<string, number>;
};

type CompareRow = {
    bid_line_id: number;
    line_num: string;
    line: LineFmt | null;
    scenarios: ScenarioScore[];
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

function shortName(name: string, max = 14): string {
    return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function CompareSetup({
    scenarios,
    lines,
    prefill,
}: {
    scenarios: ScenarioOption[];
    lines: LinePick[];
    prefill: {
        scenario_ids: number[];
        line_ids: number[];
    };
}) {
    const [selectedScenarios, setSelectedScenarios] = useState<Record<number, boolean>>(() => {
        const next: Record<number, boolean> = {};
        prefill.scenario_ids.forEach((id) => {
            next[id] = true;
        });
        return next;
    });
    const [selectedLines, setSelectedLines] = useState<Record<number, boolean>>(() => {
        const next: Record<number, boolean> = {};
        prefill.line_ids.forEach((id) => {
            next[id] = true;
        });
        return next;
    });
    const [comparing, setComparing] = useState(false);

    const selectedScenarioIds = useMemo(
        () =>
            Object.entries(selectedScenarios)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [selectedScenarios],
    );

    const anchorScenario = useMemo(() => {
        if (selectedScenarioIds.length === 0) {
            return null;
        }

        return scenarios.find((s) => s.id === selectedScenarioIds[0]) ?? null;
    }, [scenarios, selectedScenarioIds]);

    const selectableScenarios = useMemo(() => {
        if (!anchorScenario) {
            return scenarios;
        }

        return scenarios.filter((s) => s.bid_import_id === anchorScenario.bid_import_id);
    }, [scenarios, anchorScenario]);

    const selectedLineIds = useMemo(
        () =>
            Object.entries(selectedLines)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [selectedLines],
    );

    const onScenarioToggle = (scenarioId: number, checked: boolean) => {
        const picked = scenarios.find((s) => s.id === scenarioId);
        if (!picked) {
            return;
        }

        let next: Record<number, boolean>;
        if (!checked) {
            next = { ...selectedScenarios, [scenarioId]: false };
        } else if (anchorScenario && picked.bid_import_id !== anchorScenario.bid_import_id) {
            next = { [scenarioId]: true };
        } else {
            next = { ...selectedScenarios, [scenarioId]: true };
        }

        setSelectedScenarios(next);

        const shouldReloadLines =
            checked
            && (
                !anchorScenario
                || picked.bid_import_id !== anchorScenario.bid_import_id
            );
        if (shouldReloadLines) {
            router.get(
                '/app/bid-tools/scenarios/compare',
                { scenarios: String(scenarioId) },
                { preserveScroll: true, preserveState: false },
            );
        }
    };

    const runCompare = () => {
        if (selectedScenarioIds.length < 2 || selectedLineIds.length === 0) {
            return;
        }
        setComparing(true);
        router.post(
            '/app/bid-tools/scenarios/compare',
            {
                scenario_ids: selectedScenarioIds,
                line_ids: selectedLineIds,
            },
            {
                preserveScroll: true,
                onFinish: () => setComparing(false),
            },
        );
    };

    const selectLineIds = (ids: number[]) => {
        setSelectedLines((prev) => {
            const next = { ...prev };
            ids.forEach((id) => {
                next[id] = true;
            });

            return next;
        });
    };

    const clearLineSelection = () => setSelectedLines({});

    return (
        <>
            <section className="no-print space-y-4 rounded-lg border border-sidebar-border/70 p-4">
                <h2 className="text-sm font-medium">Scenarios (pick 2–8)</h2>
                {anchorScenario && (
                    <p className="text-xs text-muted-foreground">
                        Showing scenarios on bid {anchorScenario.bid_year} master import.
                        Selecting a scenario on a different import clears other picks.
                    </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                    {selectableScenarios.map((s) => (
                        <label
                            key={s.id}
                            className="flex cursor-pointer items-start gap-2 rounded-md border border-sidebar-border/50 p-2 text-sm"
                        >
                            <Checkbox
                                checked={!!selectedScenarios[s.id]}
                                onCheckedChange={(c) => onScenarioToggle(s.id, c === true)}
                            />
                            <span>
                                <span className="font-medium">{s.name}</span>
                                <span className="block text-xs text-muted-foreground">
                                    Bid {s.bid_year}
                                    {s.import_stale ? ' · stale' : ''}
                                    {' · '}
                                    Vac {s.vacation_bank}
                                    {' · '}
                                    {s.criteria_order
                                        .map((c) => CRITERIA_LABELS[c] ?? c)
                                        .join(' → ')}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
            </section>

            {lines.length > 0 && (
                <section className="no-print space-y-3">
                    <h2 className="text-sm font-medium">Lines to compare</h2>
                    <BidLinePickerToolbar
                        lines={lines}
                        onSelect={selectLineIds}
                        onClear={clearLineSelection}
                    />
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-sidebar-border/70 p-3">
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {lines.map((l) => (
                                <label
                                    key={l.id}
                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={!!selectedLines[l.id]}
                                        onCheckedChange={(c) =>
                                            setSelectedLines((s) => ({
                                                ...s,
                                                [l.id]: c === true,
                                            }))
                                        }
                                    />
                                    <span className="font-mono">{l.line_num}</span>
                                    <span className="text-muted-foreground">{l.desk_group}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <Button
                        type="button"
                        disabled={
                            selectedScenarioIds.length < 2
                            || selectedLineIds.length === 0
                            || comparing
                        }
                        onClick={runCompare}
                    >
                        Compare {selectedScenarioIds.length} scenarios
                    </Button>
                </section>
            )}
        </>
    );
}

function ComparisonResults({
    comparison,
}: {
    comparison: {
        scenarios: ScenarioSummary[];
        rows: CompareRow[];
    };
}) {
    const printedAt = new Date().toLocaleString();
    const scenarioNames = comparison.scenarios.map((s) => s.name).join(' · ');

    return (
        <section className="space-y-4">
            <div className="print-only">
                <h2 className="bid-tools-print-title">Scenario comparison</h2>
                <p className="bid-tools-print-subtitle">{scenarioNames}</p>
                <p className="bid-tools-print-subtitle">{printedAt}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold no-print">Side-by-side results</h2>
                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="no-print"
                    onClick={() => window.print()}
                >
                    Print comparison
                </Button>
            </div>

            <p className="no-print text-sm text-muted-foreground">
                Rank #1 is best fit for each scenario. Rows are ordered by the first
                scenario&apos;s ranking.
            </p>

            <div className="print-only overflow-x-auto rounded-lg border border-sidebar-border/70">
                <table className="bid-tools-print-table w-full text-left">
                    <thead>
                        <tr>
                            <th>Line</th>
                            <th>Grp</th>
                            <th>Hol</th>
                            {comparison.scenarios.map((s) => (
                                <th key={`${s.id}-rank`} colSpan={2} title={s.name}>
                                    {shortName(s.name, 12)}
                                </th>
                            ))}
                        </tr>
                        <tr>
                            <th />
                            <th />
                            <th />
                            {comparison.scenarios.map((s) => (
                                <Fragment key={s.id}>
                                    <th>#</th>
                                    <th>Scr</th>
                                </Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {comparison.rows.map((row) => {
                            const fmt = row.line;
                            return (
                                <tr key={row.bid_line_id}>
                                    <td className="font-mono">{row.line_num}</td>
                                    <td>{fmt?.desk_group ?? '—'}</td>
                                    <td>{fmt?.metrics.holidays_off ?? '—'}</td>
                                    {comparison.scenarios.map((s) => {
                                        const score = row.scenarios.find(
                                            (r) => r.scenario_id === s.id,
                                        );
                                        return (
                                            <Fragment key={`${row.bid_line_id}-${s.id}`}>
                                                <td>{score?.rank ?? '—'}</td>
                                                <td>{score?.total ?? '—'}</td>
                                            </Fragment>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="no-print overflow-x-auto rounded-lg border border-sidebar-border/70">
                <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="p-2">Line</th>
                            <th className="p-2">Group</th>
                            <th className="p-2">Start</th>
                            <th className="p-2">Hol</th>
                            {comparison.scenarios.map((s) => (
                                <th key={s.id} className="p-2 text-center" colSpan={2}>
                                    {s.name}
                                </th>
                            ))}
                            <th className="max-w-[280px] p-2 print-hide">Callouts</th>
                        </tr>
                        <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                            <th className="p-2" colSpan={4} />
                            {comparison.scenarios.map((s) => (
                                <Fragment key={`hdr-${s.id}`}>
                                    <th className="p-2 text-center">Rank</th>
                                    <th className="p-2 text-center">Score</th>
                                </Fragment>
                            ))}
                            <th className="print-hide" />
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
                                    <td className="p-2 font-mono text-xs">{row.line_num}</td>
                                    <td className="p-2">{fmt?.desk_group ?? '—'}</td>
                                    <td className="p-2 text-xs">{fmt?.start_time ?? '—'}</td>
                                    <td className="p-2">{fmt?.metrics.holidays_off ?? '—'}</td>
                                    {comparison.scenarios.map((s) => {
                                        const score = row.scenarios.find(
                                            (r) => r.scenario_id === s.id,
                                        );
                                        return (
                                            <Fragment key={`${row.bid_line_id}-${s.id}`}>
                                                <td className="p-2 text-center font-medium">
                                                    {score?.rank ?? '—'}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {score?.total ?? '—'}
                                                </td>
                                            </Fragment>
                                        );
                                    })}
                                    <td className="max-w-[280px] p-2 text-xs leading-snug text-muted-foreground whitespace-pre-wrap print-hide">
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
        scenarios: ScenarioSummary[];
        rows: CompareRow[];
    } | null;
    prefill: {
        scenario_ids: number[];
        line_ids: number[];
    };
}) {
    const page = usePage<{ flash?: { error?: string } }>();
    const flashError = page.props.flash?.error;
    const formKey = [
        prefill.scenario_ids.join(','),
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
                            Score the same bid lines under multiple preference profiles
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
                    <ComparisonResults comparison={comparison} />
                )}

                <BidToolsPrintStyles />
            </div>
        </AppLayout>
    );
}
