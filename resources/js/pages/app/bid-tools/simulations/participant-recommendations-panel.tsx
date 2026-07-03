import { useState } from 'react';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';

type KeyHolidayGroup = {
    off: number;
    total: number;
};

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

function keyHolidayLabel(group: KeyHolidayGroup | undefined): string {
    if (!group || group.total === 0) {
        return '—';
    }
    if (group.off === group.total) {
        return 'Off';
    }
    if (group.off === 0) {
        return '—';
    }

    return `${group.off}/${group.total}`;
}

export function ParticipantRecommendationsPanel({
    simulationId,
    participantId,
    minimumBidLines,
    skipsBid,
}: {
    simulationId: number;
    participantId: number;
    minimumBidLines: number;
    skipsBid: boolean;
}) {
    const [rows, setRows] = useState<RecRow[] | null>(null);
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

                const data = (await response.json()) as { rows: RecRow[] };
                setRows(data.rows);
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
                <>
                    <p className="text-xs text-muted-foreground">
                        Must rank at least {minimumBidLines} line
                        {minimumBidLines === 1 ? '' : 's'} (through #
                        {minimumBidLines}). Highlighted rows are required on the
                        bid sheet.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="p-2">#</th>
                                    <th className="p-2">Line</th>
                                    <th className="p-2">Group</th>
                                    <th className="p-2">Start</th>
                                    <th className="p-2">Xmas</th>
                                    <th className="p-2">T&apos;giving</th>
                                    <th className="p-2">Jul 4</th>
                                    <th className="p-2">Score</th>
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
                                        <td className="p-2 text-xs">
                                            {keyHolidayLabel(
                                                row.key_holidays?.christmas,
                                            )}
                                        </td>
                                        <td className="p-2 text-xs">
                                            {keyHolidayLabel(
                                                row.key_holidays?.thanksgiving,
                                            )}
                                        </td>
                                        <td className="p-2 text-xs">
                                            {keyHolidayLabel(
                                                row.key_holidays?.july_4,
                                            )}
                                        </td>
                                        <td className="p-2">{row.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </BidToolsCollapsibleSection>
    );
}
