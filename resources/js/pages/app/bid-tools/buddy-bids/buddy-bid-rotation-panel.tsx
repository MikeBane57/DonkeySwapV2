import { useMemo, useState } from 'react';
import type { BuddyBidCalendarView } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import type {
    RotationAlternation,
    RotationApplyMode,
    RotationConfig,
    Week1Leader,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-rotation';
import {
    computeRotationAssignments,
    normalizePattern,
    previewRotation,
    ROTATION_PRESETS,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-rotation';
import { groupWorkWeeks } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-work-weeks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export function BuddyBidRotationPanel({
    calendar,
    currentAssignments,
    onApply,
}: {
    calendar: BuddyBidCalendarView;
    currentAssignments: Record<string, number | null>;
    onApply: (assignments: Record<string, number | null>) => void;
}) {
    const participants = useMemo(
        () => [...calendar.participants].sort((a, b) => a.slot - b.slot),
        [calendar.participants],
    );

    const [presetId, setPresetId] =
        useState<(typeof ROTATION_PRESETS)[number]['id']>('split_23');
    const [pattern, setPattern] = useState('AABBB');
    const [alternation, setAlternation] =
        useState<RotationAlternation>('split_23');
    const [week1Leader, setWeek1Leader] = useState<Week1Leader>('a');
    const [applyMode, setApplyMode] = useState<RotationApplyMode>('fill');
    const [workWeekReferenceId, setWorkWeekReferenceId] = useState(
        participants[0]?.id ?? 0,
    );

    const config: RotationConfig = {
        pattern,
        alternation,
        week1Leader,
        applyMode,
        workWeekReferenceId,
    };

    const normalizedPattern = normalizePattern(pattern);
    const patternValid =
        normalizedPattern.length === 5 &&
        /^[ABS]+$/.test(normalizedPattern.toUpperCase());

    const workWeekCount = groupWorkWeeks(
        calendar,
        workWeekReferenceId,
    ).length;

    const preview = useMemo(() => {
        if (!patternValid) {
            return [];
        }

        return previewRotation(calendar, {
            ...config,
            pattern: normalizedPattern,
        });
    }, [calendar, config, normalizedPattern, patternValid]);

    const pendingChanges = useMemo(() => {
        if (!patternValid) {
            return 0;
        }

        const next = computeRotationAssignments(
            calendar,
            { ...config, pattern: normalizedPattern },
            currentAssignments,
        );

        return Object.keys(next).filter(
            (date) => next[date] !== currentAssignments[date],
        ).length;
    }, [
        calendar,
        config,
        currentAssignments,
        normalizedPattern,
        patternValid,
    ]);

    const applyPreset = (id: (typeof ROTATION_PRESETS)[number]['id']) => {
        const preset = ROTATION_PRESETS.find((item) => item.id === id);
        if (!preset) {
            return;
        }

        setPresetId(id);

        if (preset.pattern) {
            setPattern(preset.pattern);
        }

        setAlternation(preset.alternation);
    };

    const leaderName =
        week1Leader === 'a'
            ? participants[0]?.display_name ?? 'Buddy 1'
            : participants[1]?.display_name ?? 'Buddy 2';

    const participantName = (participantId: number | null) => {
        if (participantId === null) {
            return '—';
        }

        return (
            participants.find((participant) => participant.id === participantId)
                ?.display_name ?? 'Buddy'
        );
    };

    return (
        <div className="space-y-4 rounded-lg border border-sidebar-border/70 p-4">
            <div>
                <h2 className="text-sm font-medium">Apply rotation pattern</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                    Map a 5-day work-week pattern onto overlap days. A and B are
                    doubles for the chosen week-1 leader; S skips a slot. Vacation,
                    pull, and training days are skipped automatically.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="rotation-preset">Preset</Label>
                    <Select
                        value={presetId}
                        onValueChange={(value) =>
                            applyPreset(
                                value as (typeof ROTATION_PRESETS)[number]['id'],
                            )
                        }
                    >
                        <SelectTrigger id="rotation-preset">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ROTATION_PRESETS.map((preset) => (
                                <SelectItem key={preset.id} value={preset.id}>
                                    {preset.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {
                            ROTATION_PRESETS.find((item) => item.id === presetId)
                                ?.description
                        }
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="rotation-pattern">Work-week pattern</Label>
                    <Input
                        id="rotation-pattern"
                        value={pattern}
                        onChange={(event) => {
                            setPresetId('custom');
                            setPattern(event.target.value.toUpperCase());
                        }}
                        placeholder="AABBB"
                        maxLength={5}
                        className="font-mono uppercase"
                    />
                    {!patternValid && pattern.trim() !== '' && (
                        <p className="text-xs text-destructive">
                            Enter exactly 5 characters using A, B, or S.
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="rotation-alternation">Week-to-week</Label>
                    <Select
                        value={alternation}
                        onValueChange={(value) => {
                            setPresetId('custom');
                            setAlternation(value as RotationAlternation);
                        }}
                    >
                        <SelectTrigger id="rotation-alternation">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="repeat">
                                Repeat same pattern
                            </SelectItem>
                            <SelectItem value="flip_ab">
                                Flip A ↔ B each week
                            </SelectItem>
                            <SelectItem value="split_23">
                                Alternate 2/3 split (AA BBB ↔ AAA BB)
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="rotation-leader">Week 1 leader (A)</Label>
                    <Select
                        value={week1Leader}
                        onValueChange={(value) =>
                            setWeek1Leader(value as Week1Leader)
                        }
                    >
                        <SelectTrigger id="rotation-leader">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="a">
                                {participants[0]?.display_name ?? 'Buddy 1'}
                            </SelectItem>
                            <SelectItem value="b">
                                {participants[1]?.display_name ?? 'Buddy 2'}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Pattern A maps to {leaderName} in week 1.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="rotation-reference">Work week from</Label>
                    <Select
                        value={String(workWeekReferenceId)}
                        onValueChange={(value) =>
                            setWorkWeekReferenceId(Number(value))
                        }
                    >
                        <SelectTrigger id="rotation-reference">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {participants.map((participant) => (
                                <SelectItem
                                    key={participant.id}
                                    value={String(participant.id)}
                                >
                                    {participant.display_name}&apos;s line
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {workWeekCount} five-day work week
                        {workWeekCount === 1 ? '' : 's'} in the bid year.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="rotation-apply-mode">Apply mode</Label>
                    <Select
                        value={applyMode}
                        onValueChange={(value) =>
                            setApplyMode(value as RotationApplyMode)
                        }
                    >
                        <SelectTrigger id="rotation-apply-mode">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fill">
                                Fill unassigned overlaps only
                            </SelectItem>
                            <SelectItem value="replace">
                                Replace all overlap assignments
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {preview.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Preview (first {preview.length} work weeks)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[32rem] text-left text-xs">
                            <thead>
                                <tr className="border-b border-sidebar-border/70 text-muted-foreground">
                                    <th className="py-2 pr-3 font-medium">
                                        Week
                                    </th>
                                    <th className="py-2 pr-3 font-medium">
                                        Pattern
                                    </th>
                                    <th className="py-2 font-medium">
                                        Assignments
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((week) => (
                                    <tr
                                        key={week.weekIndex}
                                        className="border-b border-sidebar-border/40"
                                    >
                                        <td className="py-2 pr-3 align-top">
                                            {week.weekIndex}
                                        </td>
                                        <td className="py-2 pr-3 align-top font-mono">
                                            {week.pattern}
                                        </td>
                                        <td className="py-2 align-top">
                                            <div className="flex flex-wrap gap-1.5">
                                                {week.assignments.map(
                                                    (assignment) => (
                                                        <span
                                                            key={
                                                                assignment.date
                                                            }
                                                            className="rounded bg-muted px-1.5 py-0.5"
                                                            title={
                                                                assignment.date
                                                            }
                                                        >
                                                            {assignment.token ??
                                                                '·'}
                                                            {assignment.doubleParticipantId !==
                                                            null
                                                                ? ` → ${participantName(assignment.doubleParticipantId)}`
                                                                : ''}
                                                        </span>
                                                    ),
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    disabled={!patternValid || pendingChanges === 0}
                    onClick={() => {
                        const next = computeRotationAssignments(
                            calendar,
                            { ...config, pattern: normalizedPattern },
                            currentAssignments,
                        );
                        onApply(next);
                    }}
                >
                    Apply rotation
                </Button>
                {patternValid && (
                    <p className="text-xs text-muted-foreground">
                        {pendingChanges === 0
                            ? 'No changes to apply with current settings.'
                            : `${pendingChanges} overlap assignment${pendingChanges === 1 ? '' : 's'} will update.`}
                    </p>
                )}
            </div>
        </div>
    );
}
