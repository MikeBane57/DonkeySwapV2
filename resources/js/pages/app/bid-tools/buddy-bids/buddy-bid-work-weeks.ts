import type { BuddyBidCalendarView } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';

export type WorkWeek = {
    index: number;
    workDates: string[];
};

type CalendarDay = BuddyBidCalendarView['months'][number]['days'][number];

const WORK_DAYS_PER_WEEK = 5;

function orderedDays(calendar: BuddyBidCalendarView): CalendarDay[] {
    return calendar.months.flatMap((month) => month.days);
}

function isReferenceWorkDay(
    day: CalendarDay,
    referenceParticipantId: number,
): boolean {
    const cell = day.participants.find(
        (participant) => participant.participant_id === referenceParticipantId,
    );

    return cell?.line_works ?? false;
}

export function groupWorkWeeks(
    calendar: BuddyBidCalendarView,
    referenceParticipantId: number,
): WorkWeek[] {
    const weeks: WorkWeek[] = [];
    let currentDates: string[] = [];

    for (const day of orderedDays(calendar)) {
        if (!isReferenceWorkDay(day, referenceParticipantId)) {
            continue;
        }

        currentDates.push(day.date);

        if (currentDates.length === WORK_DAYS_PER_WEEK) {
            weeks.push({
                index: weeks.length,
                workDates: currentDates,
            });
            currentDates = [];
        }
    }

    return weeks;
}

export function dayByDate(
    calendar: BuddyBidCalendarView,
): Map<string, CalendarDay> {
    const map = new Map<string, CalendarDay>();

    for (const day of orderedDays(calendar)) {
        map.set(day.date, day);
    }

    return map;
}
