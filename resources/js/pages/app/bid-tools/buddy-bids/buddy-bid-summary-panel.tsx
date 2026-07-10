import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import {
    BUDDY_STATUS_CLASSES,
    BUDDY_STATUS_LABELS,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';

type SummaryRow = {
    participant_id: number;
    display_name: string;
    doubles: number;
    singles: number;
    buddy_offs: number;
    vacation_on_work: number;
    pulls_on_work: number;
    line_offs: number;
    overlap_pending: number;
};

type Balance = {
    doubles_delta: number;
    singles_adjusted_delta: number;
    unassigned_overlaps: number;
};

export function BuddyBidSummaryPanel({
    summary,
    balance,
}: {
    summary: SummaryRow[];
    balance: Balance;
}) {
    const doublesBalanced = balance.doubles_delta === 0;
    const singlesBalanced = balance.singles_adjusted_delta === 0;

    return (
        <div className="space-y-4 rounded-lg border border-sidebar-border/70 p-4">
            <h2 className="text-sm font-medium">Year totals</h2>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs">
                    <thead>
                        <tr className="border-b text-muted-foreground">
                            <th className="pr-3 pb-2 font-medium">Buddy</th>
                            <th className="pr-3 pb-2 font-medium">Doubles</th>
                            <th className="pr-3 pb-2 font-medium">Singles</th>
                            <th className="pr-3 pb-2 font-medium">Buddy off</th>
                            <th className="pr-3 pb-2 font-medium">Vacation</th>
                            <th className="pr-3 pb-2 font-medium">Pulls</th>
                            <th className="pr-3 pb-2 font-medium">Line off</th>
                            <th className="pb-2 font-medium">Unassigned</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summary.map((row) => (
                            <tr
                                key={row.participant_id}
                                className="border-b border-sidebar-border/40"
                            >
                                <td className="py-2 pr-3 font-medium">
                                    {row.display_name}
                                </td>
                                <td className="py-2 pr-3 font-mono">
                                    {row.doubles}
                                </td>
                                <td className="py-2 pr-3 font-mono">
                                    {row.singles}
                                </td>
                                <td className="py-2 pr-3 font-mono">
                                    {row.buddy_offs}
                                </td>
                                <td className="py-2 pr-3 font-mono">
                                    {row.vacation_on_work}
                                </td>
                                <td className="py-2 pr-3 font-mono">
                                    {row.pulls_on_work}
                                </td>
                                <td className="py-2 pr-3 font-mono">
                                    {row.line_offs}
                                </td>
                                <td className="py-2 font-mono">
                                    {row.overlap_pending}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
                <span
                    className={
                        doublesBalanced
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-300'
                    }
                >
                    Doubles delta: {balance.doubles_delta}
                    {doublesBalanced ? ' (balanced)' : ' (uneven)'}
                </span>
                <span
                    className={
                        singlesBalanced
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-300'
                    }
                >
                    Singles + time off delta: {balance.singles_adjusted_delta}
                    {singlesBalanced ? ' (balanced)' : ' (check vacation/pull)'}
                </span>
                {balance.unassigned_overlaps > 0 && (
                    <span className="text-amber-700 dark:text-amber-300">
                        {balance.unassigned_overlaps} overlap
                        {balance.unassigned_overlaps === 1 ? '' : 's'} still
                        unassigned
                    </span>
                )}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {(Object.keys(BUDDY_STATUS_LABELS) as BuddyDayStatus[]).map(
                    (status) => (
                        <span
                            key={status}
                            className={`rounded px-1.5 py-0.5 ${BUDDY_STATUS_CLASSES[status]}`}
                        >
                            {BUDDY_STATUS_LABELS[status]}
                        </span>
                    ),
                )}
            </div>
        </div>
    );
}
