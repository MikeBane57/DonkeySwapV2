export type SortExplanation = {
    sort_mode: string;
    sort_mode_label: string;
    summary: string;
    steps: { label: string; detail: string }[];
    criteria_order: string[];
    criteria_labels: string[];
    start_time_tiebreak_order: string[];
    start_time_tiebreak_labels: string[];
    weights: {
        holiday: number;
        personal: number;
        desk: number;
        vacation_penalty: number;
    };
    desk_tier_groups: {
        tier: number;
        label: string;
        buckets: string[];
    }[];
    line_details: {
        rank: number;
        bid_line_id: number;
        line_num: string;
        desk_bucket: string;
        desk_tier: number;
        desk_tier_label: string;
        group_boundary: boolean;
        sort_scores: Record<string, number>;
        tier_ranks: Record<string, number>;
        start_time_tiebreak_key: string;
        start_time_label: string;
        total: number;
    }[];
};

export function RankingRulesExplanation({
    explanation,
}: {
    explanation: SortExplanation | null;
}) {
    if (!explanation) {
        return null;
    }

    const showDeskTiers =
        explanation.sort_mode === 'group_ranked' ||
        explanation.sort_mode === 'blended' ||
        explanation.sort_mode === 'priority';

    return (
        <div className="no-print space-y-4 rounded-lg border border-sidebar-border/70 bg-muted/15 p-4">
            <div>
                <h3 className="text-sm font-semibold">How ranking was applied</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                        {explanation.sort_mode_label}
                    </span>
                    {' · '}
                    {explanation.summary}
                </p>
            </div>

            <ol className="list-decimal space-y-2 pl-5 text-sm">
                {explanation.steps.map((step) => (
                    <li key={step.label}>
                        <span className="font-medium">{step.label}</span>
                        <span className="text-muted-foreground">
                            {' '}
                            — {step.detail}
                        </span>
                    </li>
                ))}
            </ol>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                    Weights: Hol {explanation.weights.holiday} · Per{' '}
                    {explanation.weights.personal} · Desk{' '}
                    {explanation.weights.desk}
                </span>
                <span>
                    Categories: {explanation.criteria_labels.join(' → ')}
                </span>
            </div>

            {showDeskTiers && explanation.desk_tier_groups.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Desk tier groups
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {explanation.desk_tier_groups.map((group) => (
                            <div
                                key={group.tier}
                                className="rounded-md border border-sidebar-border/60 bg-background px-2.5 py-1.5 text-xs"
                            >
                                <span className="font-semibold">
                                    {group.label}
                                </span>
                                <span className="text-muted-foreground">
                                    {' '}
                                    = {group.buckets.join(', ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {explanation.line_details.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Per-line sort values
                    </h4>
                    <p className="text-xs text-muted-foreground">
                        Compare adjacent rows to see which rule separated them.
                        Hol/Per scores are unweighted preference points (higher is
                        better). Desk # is list position (lower is better). Tier
                        ranks are first-match list positions (lower is better).
                    </p>

                    <div className="space-y-2 md:hidden">
                        {explanation.line_details.map((line) => (
                            <article
                                key={line.bid_line_id}
                                className={`rounded-md border border-sidebar-border/60 bg-background p-2.5 text-xs ${
                                    line.group_boundary
                                        ? 'border-t-2 border-t-primary/30'
                                        : ''
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-medium">
                                        #{line.rank} {line.line_num}
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {line.total}
                                    </span>
                                </div>
                                <p className="mt-1 text-muted-foreground">
                                    {line.desk_bucket}
                                    {explanation.sort_mode === 'group_ranked' &&
                                        ` · ${line.desk_tier_label}`}
                                    {' · '}
                                    {line.start_time_label}
                                </p>
                                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                                    <div>
                                        <dt className="text-[10px] uppercase text-muted-foreground">
                                            Hol
                                        </dt>
                                        <dd>
                                            {line.sort_scores.holiday ?? '—'}{' '}
                                            (tier {line.tier_ranks.holiday ?? '—'})
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[10px] uppercase text-muted-foreground">
                                            Per
                                        </dt>
                                        <dd>
                                            {line.sort_scores.personal ?? '—'}{' '}
                                            (tier {line.tier_ranks.personal ?? '—'})
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[10px] uppercase text-muted-foreground">
                                            Desk #
                                        </dt>
                                        <dd>
                                            {line.tier_ranks.desk_order ?? '—'}
                                        </dd>
                                    </div>
                                </dl>
                            </article>
                        ))}
                    </div>

                    <div className="hidden overflow-x-auto rounded-md border border-sidebar-border/60 md:block">
                        <table className="w-full min-w-[880px] text-left text-xs">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="p-2">#</th>
                                    <th className="p-2">Line</th>
                                    <th className="p-2">Bucket</th>
                                    {explanation.sort_mode === 'group_ranked' && (
                                        <th className="p-2">Desk grp</th>
                                    )}
                                    <th className="p-2">Hol score</th>
                                    <th className="p-2">Hol tier</th>
                                    <th className="p-2">Per score</th>
                                    <th className="p-2">Per tier</th>
                                    <th className="p-2">Desk #</th>
                                    <th className="p-2">Start</th>
                                    <th className="p-2">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {explanation.line_details.map((line) => (
                                    <tr
                                        key={line.bid_line_id}
                                        className={`border-b border-sidebar-border/30 ${
                                            line.group_boundary
                                                ? 'border-t-2 border-t-primary/30'
                                                : ''
                                        }`}
                                    >
                                        <td className="p-2 font-medium">
                                            {line.rank}
                                        </td>
                                        <td className="p-2 font-mono">
                                            {line.line_num}
                                        </td>
                                        <td className="p-2">{line.desk_bucket}</td>
                                        {explanation.sort_mode ===
                                            'group_ranked' && (
                                            <td className="p-2 font-medium">
                                                {line.desk_tier_label}
                                            </td>
                                        )}
                                        <td className="p-2">
                                            {line.sort_scores.holiday ?? '—'}
                                        </td>
                                        <td className="p-2">
                                            {line.tier_ranks.holiday ?? '—'}
                                        </td>
                                        <td className="p-2">
                                            {line.sort_scores.personal ?? '—'}
                                        </td>
                                        <td className="p-2">
                                            {line.tier_ranks.personal ?? '—'}
                                        </td>
                                        <td className="p-2">
                                            {line.tier_ranks.desk_order ?? '—'}
                                        </td>
                                        <td className="p-2">
                                            {line.start_time_label}
                                        </td>
                                        <td className="p-2">{line.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}