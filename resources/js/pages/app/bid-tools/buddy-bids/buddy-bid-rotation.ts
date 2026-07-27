import type { BuddyBidCalendarView } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import type { WorkWeek } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-work-weeks';
import {
    dayByDate,
    groupWorkWeeks,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-work-weeks';

export type PatternToken = 'A' | 'B' | 'S';

export type RotationAlternation = 'repeat' | 'flip_ab' | 'split_23';

export type Week1Leader = 'a' | 'b';

export type RotationApplyMode = 'fill' | 'replace';

export type RotationConfig = {
    pattern: string;
    alternation: RotationAlternation;
    week1Leader: Week1Leader;
    applyMode: RotationApplyMode;
    workWeekReferenceId: number;
};

export type RotationAssignment = {
    date: string;
    doubleParticipantId: number | null;
    token: PatternToken | null;
};

export type RotationPreviewWeek = {
    weekIndex: number;
    pattern: string;
    assignments: RotationAssignment[];
};

const BLOCKED_STATUSES = new Set(['vacation', 'pull', 'training', 'line_off']);

export function parsePattern(input: string): PatternToken[] {
    const tokens: PatternToken[] = [];

    for (const char of input.trim().toUpperCase()) {
        if (char === 'A' || char === 'B' || char === 'S') {
            tokens.push(char);
        }
    }

    return tokens;
}

export function normalizePattern(input: string): string {
    return parsePattern(input).join('');
}

function flipPatternTokens(tokens: PatternToken[]): PatternToken[] {
    return tokens.map((token) => {
        if (token === 'A') {
            return 'B';
        }

        if (token === 'B') {
            return 'A';
        }

        return 'S';
    });
}

function split23Pattern(tokens: PatternToken[]): PatternToken[] {
    const aCount = tokens.filter((token) => token === 'A').length;
    const bCount = tokens.filter((token) => token === 'B').length;

    if (aCount === 0 || bCount === 0 || aCount === bCount) {
        return [...tokens];
    }

    const minor = aCount < bCount ? 'A' : 'B';
    const major = minor === 'A' ? 'B' : 'A';
    const nextMinorCount = Math.min(aCount, bCount) + 1;
    const nextMajorCount = Math.max(aCount, bCount) - 1;
    const abStream: PatternToken[] = [
        ...Array.from({ length: nextMinorCount }, () => minor),
        ...Array.from({ length: nextMajorCount }, () => major),
    ];

    const result: PatternToken[] = [];
    let abIndex = 0;

    for (const token of tokens) {
        if (token === 'S') {
            result.push('S');
            continue;
        }

        result.push(abStream[abIndex] ?? token);
        abIndex += 1;
    }

    return result;
}

export function patternForWeek(
    basePattern: string,
    weekIndex: number,
    alternation: RotationAlternation,
): string {
    const baseTokens = parsePattern(basePattern);

    if (baseTokens.length === 0) {
        return '';
    }

    if (alternation === 'repeat') {
        return baseTokens.join('');
    }

    if (weekIndex % 2 === 0) {
        return baseTokens.join('');
    }

    if (alternation === 'flip_ab') {
        return flipPatternTokens(baseTokens).join('');
    }

    return split23Pattern(baseTokens).join('');
}

export function isAssignableOverlapDay(
    day: BuddyBidCalendarView['months'][number]['days'][number],
): boolean {
    if (!day.is_compatible_overlap) {
        return false;
    }

    return day.participants.every((cell) => !BLOCKED_STATUSES.has(cell.status));
}

function participantIds(calendar: BuddyBidCalendarView): [number, number] {
    const sorted = [...calendar.participants].sort((a, b) => a.slot - b.slot);

    return [sorted[0].id, sorted[1].id];
}

function tokenToParticipantId(
    token: PatternToken,
    week1Leader: Week1Leader,
    participantAId: number,
    participantBId: number,
): number | null {
    if (token === 'S') {
        return null;
    }

    const leaderIsA = week1Leader === 'a';
    const tokenMeansLeader = token === 'A';

    if (leaderIsA === tokenMeansLeader) {
        return participantAId;
    }

    return participantBId;
}

function weekAssignments(
    calendar: BuddyBidCalendarView,
    week: WorkWeek,
    config: RotationConfig,
    days: Map<string, BuddyBidCalendarView['months'][number]['days'][number]>,
): RotationAssignment[] {
    const [participantAId, participantBId] = participantIds(calendar);
    const weekPattern = patternForWeek(
        config.pattern,
        week.index,
        config.alternation,
    );
    const tokens = parsePattern(weekPattern);
    const assignments: RotationAssignment[] = [];

    week.workDates.forEach((date, index) => {
        const day = days.get(date);
        const token = tokens[index] ?? null;

        if (!day || token === null) {
            assignments.push({
                date,
                doubleParticipantId: null,
                token,
            });

            return;
        }

        if (token === 'S' || !isAssignableOverlapDay(day)) {
            assignments.push({
                date,
                doubleParticipantId: null,
                token,
            });

            return;
        }

        assignments.push({
            date,
            doubleParticipantId: tokenToParticipantId(
                token,
                config.week1Leader,
                participantAId,
                participantBId,
            ),
            token,
        });
    });

    return assignments;
}

export function previewRotation(
    calendar: BuddyBidCalendarView,
    config: RotationConfig,
    weekLimit = 4,
): RotationPreviewWeek[] {
    const weeks = groupWorkWeeks(calendar, config.workWeekReferenceId);
    const days = dayByDate(calendar);

    return weeks.slice(0, weekLimit).map((week) => ({
        weekIndex: week.index + 1,
        pattern: patternForWeek(config.pattern, week.index, config.alternation),
        assignments: weekAssignments(calendar, week, config, days),
    }));
}

export function computeRotationAssignments(
    calendar: BuddyBidCalendarView,
    config: RotationConfig,
    currentAssignments: Record<string, number | null>,
): Record<string, number | null> {
    const weeks = groupWorkWeeks(calendar, config.workWeekReferenceId);
    const days = dayByDate(calendar);
    const next = { ...currentAssignments };

    if (config.applyMode === 'replace') {
        for (const day of days.values()) {
            if (isAssignableOverlapDay(day)) {
                next[day.date] = null;
            }
        }
    }

    for (const week of weeks) {
        const assignments = weekAssignments(calendar, week, config, days);

        for (const assignment of assignments) {
            if (assignment.doubleParticipantId === null) {
                continue;
            }

            if (
                config.applyMode === 'fill' &&
                currentAssignments[assignment.date] !== null &&
                currentAssignments[assignment.date] !== undefined
            ) {
                continue;
            }

            next[assignment.date] = assignment.doubleParticipantId;
        }
    }

    return next;
}

export const ROTATION_PRESETS = [
    {
        id: 'split_23',
        label: '2/3 alternating',
        pattern: 'AABBB',
        alternation: 'split_23' as const,
        description: 'Week 1: AA BBB · Week 2: AAA BB',
    },
    {
        id: 'five_five',
        label: '5/5',
        pattern: 'AAAAA',
        alternation: 'flip_ab' as const,
        description: 'All doubles one buddy, then flip each week',
    },
    {
        id: 'dds',
        label: 'Double-double-single',
        pattern: 'AASBB',
        alternation: 'repeat' as const,
        description: 'Same pattern every work week',
    },
    {
        id: 'four_one',
        label: '4/1 style',
        pattern: 'AABAA',
        alternation: 'flip_ab' as const,
        description: 'Heavy / light split, flipping A↔B weekly',
    },
    {
        id: 'custom',
        label: 'Custom',
        pattern: '',
        alternation: 'repeat' as const,
        description:
            'Enter your own A / B / S pattern (5 characters per work week)',
    },
] as const;
