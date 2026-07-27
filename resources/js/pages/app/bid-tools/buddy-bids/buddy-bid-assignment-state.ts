import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';

export const BUDDY_BID_AUTO_SAVE_MS = 60_000;

type ParticipantCell = {
    participant_id: number;
    status: string;
    line_works: boolean;
    code: string | null;
};

type CalendarDay = {
    date: string;
    day_of_month: number;
    is_compatible_overlap: boolean;
    double_participant_id: number | null;
    participants: ParticipantCell[];
};

type CalendarMonth = {
    key: string;
    label: string;
    days: CalendarDay[];
};

export type BuddyBidCalendarView = {
    bid_year: number;
    lines_can_double: boolean;
    shift_pairing: string | null;
    participants: {
        id: number;
        slot: number;
        display_name: string;
        bid_line_id: number | null;
        line_num: string | null;
        desk_group: string | null;
        start_time: string | null;
        shift_bucket: string | null;
        profile: {
            vacation_dates: string[];
            pull_dates: string[];
        };
    }[];
    months: CalendarMonth[];
    summary: {
        participant_id: number;
        display_name: string;
        doubles: number;
        singles: number;
        buddy_offs: number;
        vacation_on_work: number;
        pulls_on_work: number;
        training_on_work: number;
        line_offs: number;
        overlap_pending: number;
    }[];
    balance: {
        doubles_delta: number;
        singles_adjusted_delta: number;
        unassigned_overlaps: number;
    };
};

const OVERLAP_ASSIGNABLE = new Set<BuddyDayStatus>([
    'double',
    'buddy_off',
    'overlap_pending',
]);

function overlapStatus(
    serverStatus: string,
    participantId: number,
    doubleParticipantId: number | null,
    isCompatibleOverlap: boolean,
): string {
    if (
        !isCompatibleOverlap ||
        !OVERLAP_ASSIGNABLE.has(serverStatus as BuddyDayStatus)
    ) {
        return serverStatus;
    }

    if (doubleParticipantId === participantId) {
        return 'double';
    }

    if (doubleParticipantId !== null) {
        return 'buddy_off';
    }

    return 'overlap_pending';
}

function incrementSummary(
    counter: Record<string, number>,
    status: string,
    lineWorks: boolean,
): void {
    switch (status) {
        case 'double':
            counter.doubles += 1;
            break;
        case 'single':
            counter.singles += 1;
            break;
        case 'buddy_off':
            counter.buddy_offs += 1;
            break;
        case 'vacation':
            if (lineWorks) {
                counter.vacation_on_work += 1;
            }
            break;
        case 'pull':
            if (lineWorks) {
                counter.pulls_on_work += 1;
            }
            break;
        case 'training':
            if (lineWorks) {
                counter.training_on_work += 1;
            }
            break;
        case 'line_off':
            counter.line_offs += 1;
            break;
        case 'overlap_pending':
            counter.overlap_pending += 1;
            break;
        default:
            break;
    }
}

function computeBalance(
    summary: BuddyBidCalendarView['summary'],
    unassignedOverlaps: number,
): BuddyBidCalendarView['balance'] {
    if (summary.length !== 2) {
        return {
            doubles_delta: 0,
            singles_adjusted_delta: 0,
            unassigned_overlaps: unassignedOverlaps,
        };
    }

    const [a, b] = summary;

    const doublesDelta = Math.abs(a.doubles - b.doubles);
    const aAdjusted =
        a.singles + a.vacation_on_work + a.pulls_on_work + a.training_on_work;
    const bAdjusted =
        b.singles + b.vacation_on_work + b.pulls_on_work + b.training_on_work;

    return {
        doubles_delta: doublesDelta,
        singles_adjusted_delta: aAdjusted - bAdjusted,
        unassigned_overlaps: unassignedOverlaps,
    };
}

export function assignmentsFromCalendar(
    calendar: BuddyBidCalendarView,
): Record<string, number | null> {
    const assignments: Record<string, number | null> = {};

    for (const month of calendar.months) {
        for (const day of month.days) {
            if (day.is_compatible_overlap) {
                assignments[day.date] = day.double_participant_id;
            }
        }
    }

    return assignments;
}

export function applyLocalAssignments(
    calendar: BuddyBidCalendarView,
    assignments: Record<string, number | null>,
): BuddyBidCalendarView {
    let unassignedOverlaps = 0;

    const summaryCounters = Object.fromEntries(
        calendar.participants.map((participant) => [
            participant.id,
            {
                participant_id: participant.id,
                display_name: participant.display_name,
                doubles: 0,
                singles: 0,
                buddy_offs: 0,
                vacation_on_work: 0,
                pulls_on_work: 0,
                training_on_work: 0,
                line_offs: 0,
                overlap_pending: 0,
            },
        ]),
    ) as Record<number, BuddyBidCalendarView['summary'][number]>;

    const months = calendar.months.map((month) => ({
        ...month,
        days: month.days.map((day) => {
            const doubleParticipantId = day.is_compatible_overlap
                ? (assignments[day.date] ?? day.double_participant_id)
                : day.double_participant_id;

            if (day.is_compatible_overlap && doubleParticipantId === null) {
                unassignedOverlaps += 1;
            }

            const participants = day.participants.map((cell) => {
                const status = overlapStatus(
                    cell.status,
                    cell.participant_id,
                    doubleParticipantId,
                    day.is_compatible_overlap,
                );

                incrementSummary(
                    summaryCounters[cell.participant_id],
                    status,
                    cell.line_works,
                );

                return {
                    ...cell,
                    status,
                };
            });

            return {
                ...day,
                double_participant_id: doubleParticipantId,
                participants,
            };
        }),
    }));

    const summary = calendar.participants.map(
        (participant) => summaryCounters[participant.id],
    );

    return {
        ...calendar,
        months,
        summary,
        balance: computeBalance(summary, unassignedOverlaps),
    };
}
