import { router } from '@inertiajs/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export type ScoredLineRow = {
    rank: number;
    bid_line_id: number;
    line_num: string;
    total: number;
    parts: Record<string, number>;
    line: {
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
    } | null;
    submitted_externally: boolean;
};

export function ScoredLinesTable({
    rows,
    scenarioId,
    compact = false,
    onToggleSubmitted,
}: {
    rows: ScoredLineRow[];
    scenarioId?: number;
    compact?: boolean;
    onToggleSubmitted?: (lineId: number, submitted: boolean) => void;
}) {
    const toggleSubmitted = (lineId: number, submitted: boolean): void => {
        if (onToggleSubmitted) {
            onToggleSubmitted(lineId, submitted);
            return;
        }
        if (!scenarioId) {
            return;
        }
        router.patch(
            `/app/bid-tools/scenarios/${scenarioId}/lines/${lineId}/submitted`,
            { submitted_externally: submitted },
            { preserveScroll: true },
        );
    };

    if (rows.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Select lines above to see recommended bid order.
            </p>
        );
    }

    if (compact) {
        return (
            <div className="overflow-x-auto rounded-md border border-sidebar-border/60">
                <table className="w-full min-w-[640px] text-left text-xs">
                    <thead>
                        <tr className="border-b bg-muted/40">
                            {scenarioId && <th className="w-8 p-1.5" />}
                            <th className="w-8 p-1.5">#</th>
                            <th className="p-1.5">Line</th>
                            <th className="p-1.5">Grp</th>
                            <th className="p-1.5">Start</th>
                            <th className="p-1.5">Hol</th>
                            <th className="p-1.5">F/Sa/Su</th>
                            <th className="p-1.5">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const fmt = row.line;
                            return (
                                <tr
                                    key={row.bid_line_id}
                                    className="border-b border-sidebar-border/30"
                                >
                                    {scenarioId && (
                                        <td className="p-1.5">
                                            <Checkbox
                                                checked={row.submitted_externally}
                                                onCheckedChange={(c) =>
                                                    toggleSubmitted(
                                                        row.bid_line_id,
                                                        c === true,
                                                    )
                                                }
                                            />
                                            <Label className="sr-only">
                                                Submitted
                                            </Label>
                                        </td>
                                    )}
                                    <td className="p-1.5 font-medium">
                                        {row.rank}
                                    </td>
                                    <td className="p-1.5 font-mono">
                                        {row.line_num}
                                    </td>
                                    <td className="p-1.5">
                                        {fmt?.desk_group ?? '—'}
                                    </td>
                                    <td className="p-1.5">
                                        {fmt?.start_time ?? '—'}
                                    </td>
                                    <td className="p-1.5">
                                        {fmt?.metrics.holidays_off ?? '—'}
                                    </td>
                                    <td className="p-1.5">
                                        {fmt
                                            ? `${fmt.metrics.fri_off}/${fmt.metrics.sat_off}/${fmt.metrics.sun_off}`
                                            : '—'}
                                    </td>
                                    <td className="p-1.5 font-medium">
                                        {row.total}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
            <table className="w-full min-w-[1280px] text-left text-sm">
                <thead>
                    <tr className="border-b bg-muted/50">
                        {scenarioId && (
                            <th className="w-10 p-2">Submitted</th>
                        )}
                        <th className="w-12 p-2">#</th>
                        <th className="p-2">Line</th>
                        <th className="p-2">Group</th>
                        <th className="p-2">Source</th>
                        <th className="p-2">Start</th>
                        <th className="p-2">Rot</th>
                        <th className="p-2">WD</th>
                        <th className="p-2">Hol</th>
                        <th className="p-2">F/Sa/Su</th>
                        <th className="max-w-[200px] p-2">Training (SP/FA)</th>
                        <th className="max-w-[320px] p-2">Callouts</th>
                        <th className="p-2">Score</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const fmt = row.line;
                        return (
                            <tr
                                key={row.bid_line_id}
                                className="border-b border-sidebar-border/40"
                            >
                                {scenarioId && (
                                    <td className="p-2">
                                        <Checkbox
                                            checked={row.submitted_externally}
                                            onCheckedChange={(c) =>
                                                toggleSubmitted(
                                                    row.bid_line_id,
                                                    c === true,
                                                )
                                            }
                                        />
                                    </td>
                                )}
                                <td className="p-2 font-medium">{row.rank}</td>
                                <td className="p-2 font-mono text-xs">
                                    {row.line_num}
                                </td>
                                <td className="p-2">{fmt?.desk_group ?? '—'}</td>
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
                                    {fmt?.metrics.holidays_off ?? '—'}
                                </td>
                                <td className="p-2 text-xs">
                                    {fmt ? (
                                        <>
                                            {fmt.metrics.fri_off}/
                                            {fmt.metrics.sat_off}/
                                            {fmt.metrics.sun_off}
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="max-w-[220px] p-2 text-xs leading-snug">
                                    {fmt?.training_summary ?? '—'}
                                </td>
                                <td className="max-w-[320px] p-2 text-xs leading-snug whitespace-pre-wrap text-muted-foreground">
                                    {fmt?.schedule_callouts ?? '—'}
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
    );
}
