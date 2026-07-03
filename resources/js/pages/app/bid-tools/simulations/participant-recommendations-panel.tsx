import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';
import { BidToolsPrintStyles } from '@/pages/app/bid-tools/bid-tools-print-styles';
import type { KeyHolidayGroup } from '@/pages/app/bid-tools/holiday-metrics';
import { KeyHolidayCell } from '@/pages/app/bid-tools/key-holiday-cell';
import {
    RankingRulesExplanation,
    type SortExplanation,
} from '@/pages/app/bid-tools/ranking-rules-explanation';

type RecRow = {
    rank: number;
    bid_line_id: number;
    line_num: string;
    total: number;
    minimum_required: boolean;
    desk_group: string | null;
    start_time: string | null;
    holidays_off: number | null;
    key_holidays: {
        christmas?: KeyHolidayGroup;
        thanksgiving?: KeyHolidayGroup;
        july_4?: KeyHolidayGroup;
    };
    schedule_callouts: string;
};

function RecommendationsTable({
    rows,
    showMinimum,
}: {
    rows: RecRow[];
    showMinimum: boolean;
}) {
    return (
        <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
                <tr className="border-b bg-muted/50">
                    <th className="p-2">#</th>
                    <th className="p-2">Line</th>
                    <th className="p-2">Group</th>
                    <th className="p-2">Start</th>
                    <th className="p-2">Xmas</th>
                    <th className="p-2">T&apos;giving</th>
                    <th className="p-2">Jul 4</th>
                    <th className="p-2">Hol</th>
                    <th className="p-2">Score</th>
                    <th className="max-w-[280px] p-2">Callouts</th>
                    {showMinimum && (
                        <th className="p-2 no-print">Min bid</th>
                    )}
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
                        <td className="p-2 font-medium">{row.rank}</td>
                        <td className="p-2 font-mono text-xs">{row.line_num}</td>
                        <td className="p-2">{row.desk_group ?? '—'}</td>
                        <td className="p-2 text-xs">{row.start_time ?? '—'}</td>
                        <td className="p-2 text-xs">
                            <KeyHolidayCell
                                group={row.key_holidays?.christmas}
                            />
                        </td>
                        <td className="p-2 text-xs">
                            <KeyHolidayCell
                                group={row.key_holidays?.thanksgiving}
                            />
                        </td>
                        <td className="p-2 text-xs">
                            <KeyHolidayCell group={row.key_holidays?.july_4} />
                        </td>
                        <td className="p-2">{row.holidays_off ?? '—'}</td>
                        <td className="p-2">{row.total}</td>
                        <td className="max-w-[280px] p-2 text-xs leading-snug text-muted-foreground">
                            {row.schedule_callouts &&
                            row.schedule_callouts !== '—'
                                ? row.schedule_callouts
                                : '—'}
                        </td>
                        {showMinimum && (
                            <td className="p-2 text-xs no-print">
                                {row.minimum_required ? 'Required' : ''}
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function ParticipantRecommendationsPanel({
    simulationId,
    participantId,
    displayName,
    seniorityRank,
    minimumBidLines,
    skipsBid,
    simulationName,
    bidYear,
}: {
    simulationId: number;
    participantId: number;
    displayName: string;
    seniorityRank: number;
    minimumBidLines: number;
    skipsBid: boolean;
    simulationName: string;
    bidYear: number;
}) {
    const [rows, setRows] = useState<RecRow[] | null>(null);
    const [sortExplanation, setSortExplanation] =
        useState<SortExplanation | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    const load = () => {
        if (skipsBid || loaded || loading) {
            return;
        }

        setLoading(true);
        setError(null);

        fetch(
            `/app/bid-tools/simulations/${simulationId}/participants/${participantId}/recommendations`,
            {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            },
        )
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Could not load suggested bid order.');
                }

                const data = (await response.json()) as {
                    rows: RecRow[];
                    sort_explanation: SortExplanation;
                };
                setRows(data.rows);
                setSortExplanation(data.sort_explanation);
                setLoaded(true);
            })
            .catch((err: Error) => {
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    if (skipsBid) {
        return (
            <p className="text-sm text-muted-foreground">
                This bidder is marked as passing and will not pick a line.
            </p>
        );
    }

    const printedAt = new Date().toLocaleString();
    const requiredRows = rows?.filter((r) => r.minimum_required) ?? [];
    const printId = `bid-order-print-${participantId}`;

    return (
        <BidToolsCollapsibleSection
            title="Suggested bid order"
            summary={
                rows
                    ? `${rows.length} lines ranked`
                    : 'Expand to load rankings'
            }
            defaultOpen={false}
            onOpenChange={(open) => {
                if (open) {
                    load();
                }
            }}
        >
            {loading && (
                <p className="text-sm text-muted-foreground">
                    Loading suggested bid order…
                </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {rows && rows.length > 0 && (
                <div
                    id={printId}
                    className="bid-tools-print space-y-4"
                >
                    <div className="no-print flex flex-wrap items-start justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            Must rank at least {minimumBidLines} line
                            {minimumBidLines === 1 ? '' : 's'} (through #
                            {minimumBidLines}). Highlighted rows are required on
                            the bid sheet.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => {
                                const el = document.getElementById(printId);
                                if (!el) {
                                    return;
                                }
                                el.classList.add('bid-tools-print-active');
                                document.body.classList.add(
                                    'bid-tools-printing',
                                );
                                const cleanup = () => {
                                    el.classList.remove(
                                        'bid-tools-print-active',
                                    );
                                    document.body.classList.remove(
                                        'bid-tools-printing',
                                    );
                                };
                                window.addEventListener(
                                    'afterprint',
                                    cleanup,
                                    { once: true },
                                );
                                window.print();
                            }}
                        >
                            Print bid order
                        </Button>
                    </div>

                    <div className="print-only">
                        <h2 className="bid-tools-print-title">
                            {displayName} — suggested bid order
                        </h2>
                        <p className="bid-tools-print-subtitle">
                            Seniority #{seniorityRank} · min {minimumBidLines}{' '}
                            line{minimumBidLines === 1 ? '' : 's'} ·{' '}
                            {simulationName} · bid {bidYear}
                        </p>
                        <p className="bid-tools-print-subtitle">{printedAt}</p>
                    </div>

                    <RankingRulesExplanation
                        explanation={sortExplanation}
                        showLineDetails={false}
                        includeInPrint
                    />

                    <div className="print-only overflow-x-auto">
                        <table className="bid-tools-print-table w-full text-left">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Line</th>
                                    <th>Grp</th>
                                    <th>Start</th>
                                    <th>Xmas</th>
                                    <th>T&apos;giv</th>
                                    <th>Jul 4</th>
                                    <th>Hol</th>
                                    <th>Score</th>
                                    <th>Callouts</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requiredRows.map((row) => (
                                    <tr key={row.bid_line_id}>
                                        <td>{row.rank}</td>
                                        <td className="font-mono">
                                            {row.line_num}
                                        </td>
                                        <td>{row.desk_group ?? '—'}</td>
                                        <td>{row.start_time ?? '—'}</td>
                                        <td>
                                            {row.key_holidays?.christmas
                                                ?.off ===
                                            row.key_holidays?.christmas?.total
                                                ? 'Off'
                                                : '—'}
                                        </td>
                                        <td>
                                            {row.key_holidays?.thanksgiving
                                                ?.off ===
                                            row.key_holidays?.thanksgiving
                                                ?.total
                                                ? 'Off'
                                                : '—'}
                                        </td>
                                        <td>
                                            {row.key_holidays?.july_4?.off ===
                                            row.key_holidays?.july_4?.total
                                                ? 'Off'
                                                : '—'}
                                        </td>
                                        <td>{row.holidays_off ?? '—'}</td>
                                        <td>{row.total}</td>
                                        <td className="wrap text-xs">
                                            {row.schedule_callouts &&
                                            row.schedule_callouts !== '—'
                                                ? row.schedule_callouts
                                                : '—'}
                                        </td>
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
                        <RecommendationsTable rows={rows} showMinimum />
                    </div>

                    <BidToolsPrintStyles />
                </div>
            )}
        </BidToolsCollapsibleSection>
    );
}
