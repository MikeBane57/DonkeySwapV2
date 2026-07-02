import { Head, Link, router } from '@inertiajs/react';
import { ChevronDown, GitCompare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import AppLayout from '@/layouts/app-layout';
import { getCsrfToken } from '@/lib/csrf';
import {
    BidLinePickerToolbar,
    mapLineToPickerRow,
} from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import type { LinePickerRow } from '@/pages/app/bid-tools/bid-line-picker-toolbar';
import { BidToolsPrintStyles } from '@/pages/app/bid-tools/bid-tools-print-styles';
import { personalDatesForSave } from '@/pages/app/bid-tools/personal-dates-editor';
import { prepareDeskRankEntries } from '@/pages/app/bid-tools/rank-tier-utils';
import {
    RankingRulesExplanation
    
} from '@/pages/app/bid-tools/ranking-rules-explanation';
import type {SortExplanation} from '@/pages/app/bid-tools/ranking-rules-explanation';
import {
    ScenarioRankingPanel,
    rankingStateToSavePayload,
    scenarioToRankingState,
} from '@/pages/app/bid-tools/scenario-ranking-panel';
import type { ScenarioRankingState } from '@/pages/app/bid-tools/scenario-ranking-panel';
import {
    ScoredLinesTable
    
} from '@/pages/app/bid-tools/scored-lines-table';
import type {ScoredLineRow} from '@/pages/app/bid-tools/scored-lines-table';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Compare', href: '#' },
];

type ScoredRow = ScoredLineRow;

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
    defaultHolidayRank,
    deskCatalog,
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
        personal_dates: ScenarioRankingState['personal_dates'];
    };
    lines: (LinePickerRow & { submitted_externally?: boolean })[];
    defaultHolidayRank: ScenarioRankingState['holiday_rank'];
    deskCatalog: { key: string; label: string }[];
}) {
    const lines = useMemo(
        () => rawLines.map((l) => mapLineToPickerRow(l)),
        [rawLines],
    );

    const [rankingOpen, setRankingOpen] = useState(true);
    const [linesOpen, setLinesOpen] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [ranking, setRanking] = useState<ScenarioRankingState>(() =>
        scenarioToRankingState(scenario),
    );
    const [selected, setSelected] = useState<Record<number, boolean>>(() =>
        allLineIds(lines),
    );
    const [scoredRows, setScoredRows] = useState<ScoredRow[] | null>(null);
    const [sortExplanation, setSortExplanation] =
        useState<SortExplanation | null>(null);
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

    const saveRanking = () => {
        setSaving(true);
        setSaveMessage(null);
        router.put(
            `/app/bid-tools/scenarios/${scenario.id}`,
            rankingStateToSavePayload(scenario.name, ranking),
            {
                preserveScroll: true,
                onSuccess: () => setSaveMessage('Preferences saved.'),
                onFinish: () => setSaving(false),
            },
        );
    };

    const fetchPreview = useCallback(async () => {
        if (selectedIds.length === 0) {
            setScoredRows([]);
            setSortExplanation(null);
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
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-XSRF-TOKEN': getCsrfToken(),
                    },
                    body: JSON.stringify({
                        line_ids: selectedIds,
                        vacation_bank: ranking.vacation_bank,
                        weights: ranking.weights,
                        holiday_rank: ranking.holiday_rank,
                        desk_rank: prepareDeskRankEntries(ranking.desk_rank),
                        personal_dates: personalDatesForSave(
                            ranking.personal_dates,
                        ),
                    }),
                },
            );

            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as {
                    message?: string;
                } | null;
                throw new Error(
                    body?.message ?? 'Could not update ranking preview.',
                );
            }

            const data = (await res.json()) as {
                scored_rows: ScoredRow[];
                sort_explanation: SortExplanation | null;
            };
            setScoredRows(data.scored_rows);
            setSortExplanation(data.sort_explanation ?? null);
        } catch (error) {
            setPreviewError(
                error instanceof Error
                    ? error.message
                    : 'Could not update ranking preview.',
            );
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

    const compareLineIds = useMemo(() => {
        if (scoredRows && scoredRows.length > 0) {
            return scoredRows.map((row) => row.bid_line_id);
        }

        return selectedIds;
    }, [scoredRows, selectedIds]);

    const scenarioCompareHref =
        compareLineIds.length > 0
            ? `/app/bid-tools/scenarios/compare?${new URLSearchParams({
                  scenarios: String(scenario.id),
                  line_ids: compareLineIds.join(','),
              }).toString()}`
            : null;

    const printedAt = new Date().toLocaleString();

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
                    <div className="flex flex-wrap gap-2">
                        {scenarioCompareHref && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={scenarioCompareHref}>
                                    <GitCompare className="mr-2 h-4 w-4" />
                                    Compare with another scenario
                                </Link>
                            </Button>
                        )}
                        <Button
                            variant="default"
                            size="sm"
                            type="button"
                            disabled={saving}
                            onClick={saveRanking}
                        >
                            {saving ? 'Saving…' : 'Save preferences'}
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
                            defaultHolidayRank={defaultHolidayRank}
                            deskCatalog={deskCatalog}
                        />
                        {saveMessage && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                {saveMessage}
                            </p>
                        )}
                    </CollapsibleContent>
                </Collapsible>

                <Collapsible
                    open={linesOpen}
                    onOpenChange={setLinesOpen}
                    className="no-print rounded-lg border border-sidebar-border/70"
                >
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between px-4 py-3 text-left"
                        >
                            <span className="text-sm font-medium">
                                Lines to compare ({selectedIds.length} of{' '}
                                {lines.length})
                            </span>
                            <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${linesOpen ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 border-t border-sidebar-border/60 px-4 py-4">
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
                    </CollapsibleContent>
                </Collapsible>

                <section className="space-y-4">
                    <div className="print-only">
                        <h2 className="bid-tools-print-title">
                            {scenario.name}
                        </h2>
                        <p className="bid-tools-print-subtitle">
                            Recommended bid order · vacation bank{' '}
                            {scenario.vacation_bank}
                        </p>
                        <p className="bid-tools-print-subtitle">{printedAt}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="no-print text-lg font-semibold">
                            Recommended bid order
                        </h2>
                        {loading && (
                            <span className="text-sm text-muted-foreground">
                                Updating…
                            </span>
                        )}
                    </div>
                    {previewError && (
                        <p className="no-print text-sm text-destructive">
                            {previewError}
                        </p>
                    )}
                    {selectedIds.length === 0 ? (
                        <p className="no-print text-sm text-muted-foreground">
                            Select at least one line to see rankings.
                        </p>
                    ) : scoredRows && scoredRows.length > 0 ? (
                        <>
                            <div className="print-only overflow-x-auto rounded-lg border border-sidebar-border/70">
                                <table className="bid-tools-print-table w-full text-left">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Line</th>
                                            <th>Grp</th>
                                            <th>Start</th>
                                            <th>Hol</th>
                                            <th>F/S/S</th>
                                            <th>Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scoredRows.map((row) => {
                                            const fmt = row.line;

                                            return (
                                                <tr key={row.bid_line_id}>
                                                    <td>{row.rank}</td>
                                                    <td className="font-mono">
                                                        {row.line_num}
                                                    </td>
                                                    <td>
                                                        {fmt?.desk_group ?? '—'}
                                                    </td>
                                                    <td>
                                                        {fmt?.start_time ?? '—'}
                                                    </td>
                                                    <td>
                                                        {fmt?.metrics
                                                            .holidays_off ??
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        {fmt
                                                            ? `${fmt.metrics.fri_off}/${fmt.metrics.sat_off}/${fmt.metrics.sun_off}`
                                                            : '—'}
                                                    </td>
                                                    <td>{row.total}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="no-print">
                                <ScoredLinesTable
                                    rows={scoredRows}
                                    scenarioId={scenario.id}
                                    onToggleSubmitted={toggleSubmitted}
                                />
                            </div>

                            <RankingRulesExplanation
                                explanation={sortExplanation}
                            />
                        </>
                    ) : !loading ? (
                        <p className="no-print text-sm text-muted-foreground">
                            No ranked lines to show.
                        </p>
                    ) : null}
                </section>

                <BidToolsPrintStyles />
            </div>
        </AppLayout>
    );
}
