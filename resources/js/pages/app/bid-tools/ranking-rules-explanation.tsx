import type { KeyHolidayGroup } from '@/pages/app/bid-tools/holiday-metrics';
import { KeyHolidayCell } from '@/pages/app/bid-tools/key-holiday-cell';

export type HolidayPreferenceMatch = {
    rank: number;
    label: string;
    date: string;
    off: boolean;
    priority: string;
};

export type PersonalPreferenceMatch = {
    rank: number;
    label: string;
    kind: 'date' | 'range';
    date?: string | null;
    starts_on?: string | null;
    ends_on?: string | null;
    off_days: number;
    total_days: number;
    all_off: boolean;
    priority: string;
};

export type PreferenceEntrySummary = {
    rank: number;
    label: string;
    priority: string;
    kind?: 'date' | 'range';
    date?: string;
    starts_on?: string;
    ends_on?: string;
};

export type SortExplanationLineDetail = {
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
    holidays_off?: number;
    key_holidays?: {
        christmas?: KeyHolidayGroup;
        thanksgiving?: KeyHolidayGroup;
        july_4?: KeyHolidayGroup;
    };
    holiday_matches?: HolidayPreferenceMatch[];
    personal_matches?: PersonalPreferenceMatch[];
};

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
    preference_entries?: {
        holidays: PreferenceEntrySummary[];
        personal: PreferenceEntrySummary[];
    };
    line_details: SortExplanationLineDetail[];
};

function formatShortDate(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) {
        return ymd;
    }

    return dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

function formatHolidayMatch(match: HolidayPreferenceMatch): string {
    const label = match.label || formatShortDate(match.date);

    return `${label}: ${match.off ? 'off' : 'working'}`;
}

function formatPersonalMatch(match: PersonalPreferenceMatch): string {
    if (match.kind === 'range') {
        const rangeLabel =
            match.label ||
            `${formatShortDate(match.starts_on ?? '')}–${formatShortDate(match.ends_on ?? '')}`;

        return `${rangeLabel}: ${match.off_days}/${match.total_days} off`;
    }

    const label = match.label || formatShortDate(match.date ?? '');

    return `${label}: ${match.all_off ? 'off' : 'working'}`;
}

function PreferenceEntriesSummary({
    explanation,
}: {
    explanation: SortExplanation;
}) {
    const holidays = explanation.preference_entries?.holidays ?? [];
    const personal = explanation.preference_entries?.personal ?? [];

    if (holidays.length === 0 && personal.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {holidays.length > 0 && (
                <div className="space-y-1">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Ranked holidays
                    </h4>
                    <ul className="space-y-1 text-xs">
                        {holidays.map((entry) => (
                            <li key={`holiday-${entry.rank}-${entry.date}`}>
                                <span className="font-medium">
                                    #{entry.rank} {entry.label}
                                </span>
                                <span className="text-muted-foreground">
                                    {' '}
                                    · {formatShortDate(entry.date ?? '')} ·{' '}
                                    {entry.priority}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {personal.length > 0 && (
                <div className="space-y-1">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Ranked personal dates
                    </h4>
                    <ul className="space-y-1 text-xs">
                        {personal.map((entry) => (
                            <li
                                key={`personal-${entry.rank}-${entry.date ?? entry.starts_on}`}
                            >
                                <span className="font-medium">
                                    #{entry.rank}{' '}
                                    {entry.label ||
                                        (entry.kind === 'range'
                                            ? 'Date range'
                                            : 'Date')}
                                </span>
                                <span className="text-muted-foreground">
                                    {' '}
                                    ·{' '}
                                    {entry.kind === 'range'
                                        ? `${formatShortDate(entry.starts_on ?? '')}–${formatShortDate(entry.ends_on ?? '')}`
                                        : formatShortDate(
                                              entry.date ?? '',
                                          )}{' '}
                                    · {entry.priority}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function LineMatchList({
    holidayMatches,
    personalMatches,
}: {
    holidayMatches: HolidayPreferenceMatch[];
    personalMatches: PersonalPreferenceMatch[];
}) {
    if (holidayMatches.length === 0 && personalMatches.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <ul className="space-y-1">
            {holidayMatches.map((match) => (
                <li
                    key={`holiday-${match.rank}-${match.date}`}
                    className={
                        match.off ? 'text-foreground' : 'text-muted-foreground'
                    }
                >
                    {formatHolidayMatch(match)}
                </li>
            ))}
            {personalMatches.map((match) => (
                <li
                    key={`personal-${match.rank}-${match.date ?? match.starts_on}`}
                    className={
                        match.all_off
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                    }
                >
                    {formatPersonalMatch(match)}
                </li>
            ))}
        </ul>
    );
}

function KeyHolidaySummary({
    keyHolidays,
}: {
    keyHolidays: SortExplanationLineDetail['key_holidays'];
}) {
    if (!keyHolidays) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span>
                    Xmas <KeyHolidayCell group={keyHolidays.christmas} />
                </span>
                <span>
                    T&apos;giv{' '}
                    <KeyHolidayCell group={keyHolidays.thanksgiving} />
                </span>
                <span>
                    Jul 4 <KeyHolidayCell group={keyHolidays.july_4} />
                </span>
            </div>
        </div>
    );
}

export function RankingRulesExplanation({
    explanation,
    showLineDetails = true,
    includeInPrint = false,
    maxLineDetails,
    minimumDepth,
    lineDetailIds,
}: {
    explanation: SortExplanation | null;
    showLineDetails?: boolean;
    includeInPrint?: boolean;
    maxLineDetails?: number;
    minimumDepth?: number;
    lineDetailIds?: number[];
}) {
    if (!explanation) {
        return null;
    }

    const showDeskTiers =
        explanation.sort_mode === 'group_ranked' ||
        explanation.sort_mode === 'blended' ||
        explanation.sort_mode === 'priority';

    let visibleLineDetails = explanation.line_details;
    if (lineDetailIds && lineDetailIds.length > 0) {
        const allowed = new Set(lineDetailIds);
        visibleLineDetails = visibleLineDetails.filter((line) =>
            allowed.has(line.bid_line_id),
        );
    }
    if (maxLineDetails !== undefined && maxLineDetails > 0) {
        visibleLineDetails = visibleLineDetails.slice(0, maxLineDetails);
    }

    return (
        <div
            className={`space-y-4 rounded-lg border border-sidebar-border/70 bg-muted/15 p-4 ${includeInPrint ? '' : 'no-print'}`}
        >
            <div>
                <h3 className="text-sm font-semibold">
                    How ranking was applied
                </h3>
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

            <PreferenceEntriesSummary explanation={explanation} />

            {showDeskTiers && explanation.desk_tier_groups.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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

            {showLineDetails && visibleLineDetails.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Ranked lines
                    </h4>
                    <p className="text-xs text-muted-foreground">
                        One table showing sort order, key holidays, and whether
                        each ranked holiday or personal date is off on that
                        line.
                    </p>

                    <div className="space-y-2 md:hidden">
                        {visibleLineDetails.map((line) => (
                            <article
                                key={line.bid_line_id}
                                className={`rounded-md border border-sidebar-border/60 bg-background p-2.5 text-xs ${
                                    minimumDepth !== undefined &&
                                    line.rank <= minimumDepth
                                        ? 'bg-amber-500/10'
                                        : ''
                                } ${
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
                                <div className="mt-2">
                                    <KeyHolidaySummary
                                        keyHolidays={line.key_holidays}
                                    />
                                </div>
                                <LineMatchList
                                    holidayMatches={line.holiday_matches ?? []}
                                    personalMatches={
                                        line.personal_matches ?? []
                                    }
                                />
                                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                                    <div>
                                        <dt className="text-[10px] text-muted-foreground uppercase">
                                            Hol
                                        </dt>
                                        <dd>
                                            {line.sort_scores.holiday ?? '—'}{' '}
                                            (tier{' '}
                                            {line.tier_ranks.holiday ?? '—'})
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[10px] text-muted-foreground uppercase">
                                            Per
                                        </dt>
                                        <dd>
                                            {line.sort_scores.personal ?? '—'}{' '}
                                            (tier{' '}
                                            {line.tier_ranks.personal ?? '—'})
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[10px] text-muted-foreground uppercase">
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
                        <table className="w-full min-w-[1040px] text-left text-xs">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="p-2">#</th>
                                    <th className="p-2">Line</th>
                                    <th className="p-2">Bucket</th>
                                    {explanation.sort_mode ===
                                        'group_ranked' && (
                                        <th className="p-2">Desk grp</th>
                                    )}
                                    <th className="min-w-[10rem] p-2">
                                        Key holidays
                                    </th>
                                    <th className="min-w-[12rem] p-2">
                                        Your dates off
                                    </th>
                                    <th className="p-2">Hol score</th>
                                    <th className="p-2">Per score</th>
                                    <th className="p-2">Desk #</th>
                                    <th className="p-2">Start</th>
                                    <th className="p-2">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleLineDetails.map((line) => (
                                    <tr
                                        key={line.bid_line_id}
                                        className={`border-b border-sidebar-border/30 ${
                                            minimumDepth !== undefined &&
                                            line.rank <= minimumDepth
                                                ? 'bg-amber-500/10'
                                                : ''
                                        } ${
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
                                        <td className="p-2">
                                            {line.desk_bucket}
                                        </td>
                                        {explanation.sort_mode ===
                                            'group_ranked' && (
                                            <td className="p-2 font-medium">
                                                {line.desk_tier_label}
                                            </td>
                                        )}
                                        <td className="p-2 align-top">
                                            <KeyHolidaySummary
                                                keyHolidays={line.key_holidays}
                                            />
                                        </td>
                                        <td className="p-2 align-top">
                                            <LineMatchList
                                                holidayMatches={
                                                    line.holiday_matches ?? []
                                                }
                                                personalMatches={
                                                    line.personal_matches ?? []
                                                }
                                            />
                                        </td>
                                        <td className="p-2">
                                            {line.sort_scores.holiday ?? '—'}
                                        </td>
                                        <td className="p-2">
                                            {line.sort_scores.personal ?? '—'}
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
