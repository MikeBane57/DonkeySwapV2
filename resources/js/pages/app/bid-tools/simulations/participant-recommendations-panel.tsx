import { GripVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
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

type OrderSource = 'computed' | 'manual';

type RecommendationsPayload = {
    minimum_depth: number;
    rows: RecRow[];
    computed_rows: RecRow[];
    order_source: OrderSource;
    manual_line_order: number[] | null;
    sort_explanation: SortExplanation;
};

function csrfToken(): string {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? ''
    );
}

function moveIndex<T>(list: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0) {
        return list;
    }
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);

    return next;
}

function withRanks(rows: RecRow[], minimumBidLines: number): RecRow[] {
    return rows.map((row, index) => ({
        ...row,
        rank: index + 1,
        minimum_required: index + 1 <= minimumBidLines,
    }));
}

function DraggableLineRow({
    row,
    index,
    showMinimum,
    onReorder,
}: {
    row: RecRow;
    index: number;
    showMinimum: boolean;
    onReorder: (from: number, to: number) => void;
}) {
    const [over, setOver] = useState(false);

    return (
        <tr
            className={`${row.minimum_required ? 'bg-amber-500/10' : ''} ${
                over ? 'bg-muted/40' : ''
            } border-b border-sidebar-border/40`}
            onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const from = Number.parseInt(
                    e.dataTransfer.getData('text/plain'),
                    10,
                );
                if (!Number.isNaN(from)) {
                    onReorder(from, index);
                }
            }}
        >
            <td className="p-2 no-print">
                <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(index));
                        e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                    aria-label={`Drag line ${row.line_num}`}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </td>
            <td className="p-2 font-medium">{row.rank}</td>
            <td className="p-2 font-mono text-xs">{row.line_num}</td>
            <td className="p-2">{row.desk_group ?? '—'}</td>
            <td className="p-2 text-xs">{row.start_time ?? '—'}</td>
            <td className="p-2 text-xs">
                <KeyHolidayCell group={row.key_holidays?.christmas} />
            </td>
            <td className="p-2 text-xs">
                <KeyHolidayCell group={row.key_holidays?.thanksgiving} />
            </td>
            <td className="p-2 text-xs">
                <KeyHolidayCell group={row.key_holidays?.july_4} />
            </td>
            <td className="p-2">{row.holidays_off ?? '—'}</td>
            <td className="p-2">{row.total}</td>
            <td className="max-w-[280px] p-2 text-xs leading-snug text-muted-foreground">
                {row.schedule_callouts && row.schedule_callouts !== '—'
                    ? row.schedule_callouts
                    : '—'}
            </td>
            {showMinimum && (
                <td className="p-2 text-xs no-print">
                    {row.minimum_required ? 'Required' : ''}
                </td>
            )}
        </tr>
    );
}

function RecommendationsTable({
    rows,
    showMinimum,
    editable,
    onReorder,
}: {
    rows: RecRow[];
    showMinimum: boolean;
    editable?: boolean;
    onReorder?: (from: number, to: number) => void;
}) {
    return (
        <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
                <tr className="border-b bg-muted/50">
                    {editable && <th className="w-8 p-2 no-print" />}
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
                {rows.map((row, index) =>
                    editable && onReorder ? (
                        <DraggableLineRow
                            key={row.bid_line_id}
                            row={row}
                            index={index}
                            showMinimum={showMinimum}
                            onReorder={onReorder}
                        />
                    ) : (
                        <tr
                            key={row.bid_line_id}
                            className={
                                row.minimum_required
                                    ? 'border-b border-sidebar-border/40 bg-amber-500/10'
                                    : 'border-b border-sidebar-border/40'
                            }
                        >
                            <td className="p-2 font-medium">{row.rank}</td>
                            <td className="p-2 font-mono text-xs">
                                {row.line_num}
                            </td>
                            <td className="p-2">{row.desk_group ?? '—'}</td>
                            <td className="p-2 text-xs">
                                {row.start_time ?? '—'}
                            </td>
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
                                <KeyHolidayCell
                                    group={row.key_holidays?.july_4}
                                />
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
                    ),
                )}
            </tbody>
        </table>
    );
}

function applyPayload(
    data: RecommendationsPayload,
    setters: {
        setRows: (rows: RecRow[]) => void;
        setSortExplanation: (value: SortExplanation) => void;
        setOrderSource: (value: OrderSource) => void;
        setDirty: (value: boolean) => void;
    },
) {
    setters.setRows(data.rows);
    setters.setSortExplanation(data.sort_explanation);
    setters.setOrderSource(data.order_source);
    setters.setDirty(false);
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
    const [orderSource, setOrderSource] = useState<OrderSource>('computed');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [dirty, setDirty] = useState(false);

    const lineOrderUrl = `/app/bid-tools/simulations/${simulationId}/participants/${participantId}/line-order`;
    const recommendationsUrl = `/app/bid-tools/simulations/${simulationId}/participants/${participantId}/recommendations`;

    const applyResponse = (data: RecommendationsPayload) => {
        applyPayload(data, {
            setRows,
            setSortExplanation,
            setOrderSource,
            setDirty,
        });
    };

    const fetchRecommendations = async () => {
        const response = await fetch(recommendationsUrl, {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Could not load bid order.');
        }

        return (await response.json()) as RecommendationsPayload;
    };

    const load = () => {
        if (skipsBid || loaded || loading) {
            return;
        }

        setLoading(true);
        setError(null);

        fetchRecommendations()
            .then((data) => {
                applyResponse(data);
                setLoaded(true);
            })
            .catch((err: Error) => {
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const reload = () => {
        setLoading(true);
        setError(null);

        fetchRecommendations()
            .then(applyResponse)
            .catch((err: Error) => {
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const saveLineOrder = async (lineOrder: number[] | null) => {
        setSaving(true);
        setError(null);

        try {
            const response = await fetch(lineOrderUrl, {
                method: 'PUT',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ line_order: lineOrder }),
            });

            if (!response.ok) {
                throw new Error('Could not save bid order.');
            }

            applyResponse((await response.json()) as RecommendationsPayload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save bid order.');
        } finally {
            setSaving(false);
        }
    };

    const handleReorder = (from: number, to: number) => {
        if (!rows) {
            return;
        }

        setRows(withRanks(moveIndex(rows, from, to), minimumBidLines));
        setDirty(true);
    };

    const sectionSummary = useMemo(() => {
        if (!rows) {
            return 'Expand to load rankings';
        }

        const mode =
            dirty || orderSource === 'manual' ? 'Manual' : 'Computed';
        const suffix = dirty ? ' · unsaved' : '';

        return `${mode} · ${rows.length} lines${suffix}`;
    }, [rows, orderSource, dirty]);

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
    const usingManual = orderSource === 'manual' || dirty;
    const orderTitle = usingManual ? 'Bid order' : 'Suggested bid order';

    return (
        <BidToolsCollapsibleSection
            title={orderTitle}
            summary={sectionSummary}
            defaultOpen={false}
            onOpenChange={(open) => {
                if (open) {
                    load();
                }
            }}
        >
            {loading && (
                <p className="text-sm text-muted-foreground">
                    Loading bid order…
                </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {rows && rows.length > 0 && (
                <div id={printId} className="bid-tools-print space-y-4">
                    <div className="no-print space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                                {usingManual ? (
                                    <>
                                        Custom bid order for this bidder. Drag
                                        rows to match their actual bid sheet.
                                    </>
                                ) : (
                                    <>
                                        Ranked from preferences. Drag rows if
                                        you know what they are actually bidding.
                                    </>
                                )}{' '}
                                Must rank at least {minimumBidLines} line
                                {minimumBidLines === 1 ? '' : 's'} (through #
                                {minimumBidLines}).
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {dirty && (
                                    <>
                                        <Button
                                            size="sm"
                                            type="button"
                                            disabled={saving}
                                            onClick={() =>
                                                saveLineOrder(
                                                    rows.map(
                                                        (row) =>
                                                            row.bid_line_id,
                                                    ),
                                                )
                                            }
                                        >
                                            {saving ? 'Saving…' : 'Save order'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            type="button"
                                            disabled={saving}
                                            onClick={reload}
                                        >
                                            Discard
                                        </Button>
                                    </>
                                )}
                                {!dirty && orderSource === 'manual' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        type="button"
                                        disabled={saving}
                                        onClick={() => saveLineOrder(null)}
                                    >
                                        Use computed order
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                        const el =
                                            document.getElementById(printId);
                                        if (!el) {
                                            return;
                                        }
                                        el.classList.add(
                                            'bid-tools-print-active',
                                        );
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
                        </div>
                    </div>

                    <div className="print-only">
                        <h2 className="bid-tools-print-title">
                            {displayName} — {orderTitle.toLowerCase()}
                        </h2>
                        <p className="bid-tools-print-subtitle">
                            Seniority #{seniorityRank} · min {minimumBidLines}{' '}
                            line{minimumBidLines === 1 ? '' : 's'} ·{' '}
                            {simulationName} · bid {bidYear}
                            {usingManual ? ' · manual order' : ''}
                        </p>
                        <p className="bid-tools-print-subtitle">{printedAt}</p>
                    </div>

                    {!usingManual && (
                        <RankingRulesExplanation
                            explanation={sortExplanation}
                            showLineDetails={false}
                            includeInPrint
                        />
                    )}
                    {usingManual && (
                        <p className="rounded-lg border border-sidebar-border/70 bg-muted/15 p-3 text-sm text-muted-foreground">
                            Using a custom bid order for this bidder.
                            {orderSource === 'computed' && dirty
                                ? ' Save to apply it to the simulation.'
                                : ' Simulation picks follow this order.'}
                        </p>
                    )}

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
                        <RecommendationsTable
                            rows={rows}
                            showMinimum
                            editable
                            onReorder={handleReorder}
                        />
                    </div>

                    <BidToolsPrintStyles />
                </div>
            )}
        </BidToolsCollapsibleSection>
    );
}
