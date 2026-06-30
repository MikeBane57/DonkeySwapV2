import { Head, Link, router } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import {
    BidLinePickerToolbar,
    mapLineToPickerRow,
    type LinePickerRow,
} from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import {
    ScenarioRankingPanel,
    scenarioToRankingState,
    type ScenarioRankingState,
} from '@/pages/app/bid-tools/scenario-ranking-panel';
import { getCsrfToken } from '@/lib/csrf';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Compare', href: '#' },
];

type LineFmt = {
    desk_group: string;
    start_time: string;
    source_label: string | null;
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
    line: LineFmt | null;
    submitted_externally: boolean;
};

function allLineIds(lines: LinePickerRow[]): Record<number, boolean> {
    const next: Record<number, boolean> = {};
    lines.forEach((l) => {
        next[l.id] = true;
    });

    return next;
}

export default function BidScenarioRanked({
    scenario,
    lines: rawLines,
    holidaysCatalog,
    deskCatalog,
    startTimeCatalog,
}: {
    scenario: {
        id: number;
        name: string;
        vacation_bank: number;
        import_stale: boolean;
        import: { bid_year: number };
        weights: Record<string, unknown> & { criteria_order?: string[] };
        holiday_rank: ScenarioRankingState['holiday_rank'];
        desk_rank: ScenarioRankingState['desk_rank'];
        start_time_rank: ScenarioRankingState['start_time_rank'];
        personal_dates: ScenarioRankingState['personal_dates'];
    };
    lines: LinePickerRow[];
    holidaysCatalog: { date: string; id: string; label: string }[];
    deskCatalog: { key: string; label: string }[];
    startTimeCatalog: { key: string; label: string }[];
}) {
    const lines = useMemo(
        () => rawLines.map((l) => mapLineToPickerRow(l)),
        [rawLines],
    );

    const [rankingOpen, setRankingOpen] = useState(true);
    const [ranking, setRanking] = useState<ScenarioRankingState>(() =>
        scenarioToRankingState(scenario),
    );
    const [selected, setSelected] = useState<Record<number, boolean>>(() =>
        allLineIds(lines),
    );
    const [scoredRows, setScoredRows] = useState<ScoredRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const selectedIds = useMemo(
        () =>
            Object.entries(selected)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [selected],
    );

    const selectLineIds = (ids: number[]) => {
        const next: Record<number, boolean> = {};
        ids.forEach((id) => {
            next[id] = true;
        });
        setSelected(next);
    };

    const toggleSubmitted = (lineId: number, submitted: boolean): void => {
        router.patch(
            `/app/bid-tools/scenarios/${scenario.id}/lines/${lineId}/submitted`,
            { submitted_externally: submitted },
            { preserveScroll: true },
        );
        setScoredRows((rows) =>
            rows
                ? rows.map((row) =>
                      row.bid_line_id === lineId
                          ? { ...row, submitted_externally: submitted }
                          : row,
                  )
                : rows,
        );
    };

    const fetchPreview = useCallback(async () => {
        if (selectedIds.length === 0) {
            setScoredRows([]);
            setPreviewError(null);

            return;
        }

        setLoading(true);
        setPreviewError(null);

        try {
            const res = await fetch(
                `/app/bid-tools/scenarios/${scenario.id}/preview-score`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': getCsrfToken(),
                    },
                    body: JSON.stringify({
                        line_ids: selectedIds,
                        vacation_bank: ranking.vacation_bank,
                        weights: ranking.weights,
                        holiday_rank: ranking.holiday_rank,
                        desk_rank: ranking.desk_rank,
                        start_time_rank: ranking.start_time_rank,
                        personal_dates: ranking.personal_dates.filter(
                            (p) => p.date,
                        ),
                    }),
                },
            );

            if (!res.ok) {
                throw new Error('Could not update ranking preview.');
            }

            const data = (await res.json()) as { scored_rows: ScoredRow[] };
            setScoredRows(data.scored_rows);
        } catch {
            setPreviewError('Could not update ranking preview.');
        } finally {
            setLoading(false);
        }
    }, [scenario.id, selectedIds, ranking]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchPreview();
        }, 300);

        return () => window.clearTimeout(timer);
    }, [fetchPreview]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Compare · ${scenario.name}`} />
            <div className="bid-tools-print mx-auto max-w-6xl space-y-6 p-4 pb-12">
                <div className="no-print flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {scenario.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Bid {scenario.import.bid_year}
                            {scenario.import_stale && (
                                <span className="ml-2 text-amber-700 dark:text-amber-300">
                                    (import replaced — scenario may be stale)
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/app/bid-tools/scenarios/${scenario.id}/edit`}
                            >
                                Full scenario editor
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

                <Collapsible
                    open={rankingOpen}
                    onOpenChange={setRankingOpen}
                    className="no-print rounded-lg border border-sidebar-border/70"
                >
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between px-4 py-3 text-left"
                        >
                            <span className="text-sm font-medium">
                                Ranking preferences
                            </span>
                            <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${rankingOpen ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-sidebar-border/60 px-4 py-4">
                        <ScenarioRankingPanel
                            value={ranking}
                            onChange={setRanking}
                            holidaysCatalog={holidaysCatalog}
                            deskCatalog={deskCatalog}
                            startTimeCatalog={startTimeCatalog}
                        />
                    </CollapsibleContent>
                </Collapsible>

                <section className="no-print space-y-3 rounded-lg border border-sidebar-border/70 p-4">
                    <h2 className="text-sm font-medium">Lines to compare</h2>
                    <p className="text-xs text-muted-foreground">
                        AM = desk group starts with D, PM = A, Mid = M. All
                        lines are selected by default.
                    </p>
                    <BidLinePickerToolbar
                        lines={lines}
                        onSelect={selectLineIds}
                        onClear={() => setSelected({})}
                    />
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-sidebar-border/60 p-3">
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
                                    <span className="text-xs text-muted-foreground">
                                        {l.start_time}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold">
                            Recommended bid order
                        </h2>
                        {loading && (
                            <span className="text-sm text-muted-foreground">
                                Updating…
                            </span>
                        )}
                    </div>
                    {previewError && (
                        <p className="text-sm text-destructive">{previewError}</p>
                    )}
                    {selectedIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Select at least one line to see rankings.
                        </p>
                    ) : scoredRows && scoredRows.length > 0 ? (
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
                                        <th className="max-w-[220px] p-2">
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
                                                    <Checkbox
                                                        checked={
                                                            row.submitted_externally
                                                        }
                                                        onCheckedChange={(c) =>
                                                            toggleSubmitted(
                                                                row.bid_line_id,
                                                                c === true,
                                                            )
                                                        }
                                                    />
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
                                                            {fmt.metrics.fri_off}
                                                            /
                                                            {fmt.metrics.sat_off}
                                                            /
                                                            {fmt.metrics.sun_off}
                                                        </>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="max-w-[220px] p-2 text-xs leading-snug">
                                                    {fmt?.training_summary ??
                                                        '—'}
                                                </td>
                                                <td className="max-w-[220px] p-2 text-xs leading-snug text-muted-foreground">
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
                    ) : !loading ? (
                        <p className="text-sm text-muted-foreground">
                            No ranked lines to show.
                        </p>
                    ) : null}
                </section>

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
