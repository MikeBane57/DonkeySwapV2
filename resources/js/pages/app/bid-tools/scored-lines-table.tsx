import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';
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

function MobileStat({
    label,
    value,
}: {
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="text-sm">{value}</dd>
        </div>
    );
}

function ScoredLineMobileCard({
    row,
    scenarioId,
    onToggleSubmitted,
}: {
    row: ScoredLineRow;
    scenarioId?: number;
    onToggleSubmitted: (lineId: number, submitted: boolean) => void;
}) {
    const fmt = row.line;
    const workdays = fmt
        ? (fmt.workdays_from_file ?? fmt.workdays_computed)
        : '—';

    return (
        <article className="rounded-lg border border-sidebar-border/60 bg-card p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                            {row.rank}
                        </span>
                        <span className="truncate font-mono text-sm font-medium">
                            {row.line_num}
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {fmt?.desk_group ?? '—'} · {fmt?.start_time ?? '—'}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        Score
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                        {row.total}
                    </p>
                </div>
            </div>

            {scenarioId && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                        checked={row.submitted_externally}
                        onCheckedChange={(c) =>
                            onToggleSubmitted(row.bid_line_id, c === true)
                        }
                    />
                    Submitted externally
                </label>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                <MobileStat label="Group" value={fmt?.desk_group ?? '—'} />
                <MobileStat label="Start" value={fmt?.start_time ?? '—'} />
                <MobileStat
                    label="Holidays off"
                    value={fmt?.metrics.holidays_off ?? '—'}
                />
                <MobileStat
                    label="F / Sa / Su"
                    value={
                        fmt
                            ? `${fmt.metrics.fri_off}/${fmt.metrics.sat_off}/${fmt.metrics.sun_off}`
                            : '—'
                    }
                />
                <MobileStat label="Rotation" value={fmt?.rotation ?? '—'} />
                <MobileStat label="Workdays" value={workdays} />
            </dl>

            {fmt?.source_label && (
                <p className="mt-2 text-xs text-muted-foreground">
                    Source: {fmt.source_label}
                </p>
            )}

            {fmt?.training_summary && fmt.training_summary !== '—' && (
                <p className="mt-2 text-xs leading-snug">
                    <span className="font-medium">Training:</span>{' '}
                    {fmt.training_summary}
                </p>
            )}

            {fmt?.schedule_callouts && fmt.schedule_callouts !== '—' && (
                <p className="mt-2 text-xs leading-snug whitespace-pre-wrap text-muted-foreground">
                    {fmt.schedule_callouts}
                </p>
            )}
        </article>
    );
}

function ScoredLineCompactMobileCard({
    row,
    scenarioId,
    onToggleSubmitted,
}: {
    row: ScoredLineRow;
    scenarioId?: number;
    onToggleSubmitted: (lineId: number, submitted: boolean) => void;
}) {
    const fmt = row.line;

    return (
        <article className="flex items-center gap-2 rounded-md border border-sidebar-border/50 bg-card px-2.5 py-2">
            {scenarioId && (
                <Checkbox
                    checked={row.submitted_externally}
                    onCheckedChange={(c) =>
                        onToggleSubmitted(row.bid_line_id, c === true)
                    }
                />
            )}
            <span className="w-6 shrink-0 text-center text-xs font-semibold">
                {row.rank}
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-medium">
                    {row.line_num}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    {fmt?.desk_group ?? '—'} · {fmt?.start_time ?? '—'} · Hol{' '}
                    {fmt?.metrics.holidays_off ?? '—'}
                </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
                {row.total}
            </span>
        </article>
    );
}

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
            <>
                <div className="space-y-2 md:hidden">
                    {rows.map((row) => (
                        <ScoredLineCompactMobileCard
                            key={row.bid_line_id}
                            row={row}
                            scenarioId={scenarioId}
                            onToggleSubmitted={toggleSubmitted}
                        />
                    ))}
                </div>
                <div className="hidden overflow-x-auto rounded-md border border-sidebar-border/60 md:block">
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
            </>
        );
    }

    return (
        <>
            <div className="space-y-3 md:hidden">
                {rows.map((row) => (
                    <ScoredLineMobileCard
                        key={row.bid_line_id}
                        row={row}
                        scenarioId={scenarioId}
                        onToggleSubmitted={toggleSubmitted}
                    />
                ))}
            </div>
            <div className="hidden overflow-x-auto rounded-lg border border-sidebar-border/70 md:block">
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
                            <th className="max-w-[200px] p-2">
                                Training (SP/FA)
                            </th>
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
                                    )}
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
        </>
    );
}
