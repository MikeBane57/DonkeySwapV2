import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import type { ShiftWindow } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-shift-times';
import {
    hhmmToMinutes,
    shiftWindowForTraining,
    shiftWindowFromLineStart,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-shift-times';

type CalendarDay = {
    date: string;
    participants: {
        participant_id: number;
        status: BuddyDayStatus;
        code: string | null;
    }[];
};

type CalendarMonth = {
    days: CalendarDay[];
};

export type CalendarParticipantForExport = {
    id: number;
    display_name: string;
    desk_group: string | null;
    start_time: string | null;
};

const BUDDY_GCAL_LOCATION = 'NOC, 2170 Research Row, Dallas, TX 75235';

const TRAINING_SUMMARY = 'DOM recurrent training';

const GOOGLE_BUSY_STATUSES: BuddyDayStatus[] = [
    'single',
    'double',
    'training',
    'overlap_pending',
];

type CalendarEventDraft = {
    uidSuffix: string;
    summary: string;
    window: ShiftWindow;
    description: string;
};

function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

function ymdHhmmToIcsLocal(ymd: string, hhmm: string): string {
    const [y, m, d] = ymd.split('-');
    return `${y}${m}${d}T${hhmm}00`;
}

function addDaysToYmd(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
}

function resolveIcsEndDate(ymd: string, window: ShiftWindow): string {
    if (window.endsNextCalendarDay) {
        return addDaysToYmd(ymd, 1);
    }
    if (hhmmToMinutes(window.eventEnd) < hhmmToMinutes(window.eventStart)) {
        return addDaysToYmd(ymd, 1);
    }
    return ymd;
}

function eventDtEnd(
    ymd: string,
    window: ShiftWindow,
): { start: string; end: string } {
    const start = ymdHhmmToIcsLocal(ymd, window.eventStart);
    const end = ymdHhmmToIcsLocal(
        resolveIcsEndDate(ymd, window),
        window.eventEnd,
    );
    return { start, end };
}

/** Desk title only (e.g. AG4 → G4, DG1 → G1). */
export function calendarDeskTitle(
    code: string | null,
    deskGroup: string | null,
): string {
    const raw = (code?.trim() || deskGroup?.trim() || '').toUpperCase();
    if (!raw) {
        return 'Work';
    }
    if (/^[AD]G/.test(raw)) {
        return raw.slice(1);
    }
    return raw;
}

function pushIcsEvent(
    lines: string[],
    draft: CalendarEventDraft,
    ymd: string,
    participantId: number,
    timeZone: string,
    now: string,
): void {
    const { start, end } = eventDtEnd(ymd, draft.window);
    const uid = `buddy-bid-${participantId}-${ymd}-${draft.uidSuffix}@donkeyswap`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;TZID=${timeZone}:${start}`);
    lines.push(`DTEND;TZID=${timeZone}:${end}`);
    lines.push(`SUMMARY:${escapeIcsText(draft.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(draft.description)}`);
    lines.push(`LOCATION:${escapeIcsText(BUDDY_GCAL_LOCATION)}`);
    lines.push('TRANSP:OPAQUE');
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
}

function workShiftEvent(
    desk: string,
    window: ShiftWindow,
    bidYear: number,
    uidSuffix: string,
): CalendarEventDraft {
    return {
        uidSuffix,
        summary: desk,
        window,
        description: `Buddy bid ${bidYear} · ${desk} ${window.workStart}-${window.workEnd}`,
    };
}

function eventsForDay(
    participant: CalendarParticipantForExport,
    partner: CalendarParticipantForExport | null,
    day: CalendarDay,
    bidYear: number,
): CalendarEventDraft[] {
    const cell = day.participants.find(
        (p) => p.participant_id === participant.id,
    );
    if (!cell || !GOOGLE_BUSY_STATUSES.includes(cell.status)) {
        return [];
    }

    if (cell.status === 'training') {
        const window = shiftWindowForTraining(cell.code);
        if (!window) {
            return [];
        }
        return [
            {
                uidSuffix: 'training',
                summary: TRAINING_SUMMARY,
                window,
                description: `Buddy bid ${bidYear} · DOM recurrent training`,
            },
        ];
    }

    if (cell.status === 'double' && partner) {
        const partnerCell = day.participants.find(
            (p) => p.participant_id === partner.id,
        );
        const ownWindow = shiftWindowFromLineStart(participant.start_time);
        const partnerWindow = shiftWindowFromLineStart(partner.start_time);
        if (!ownWindow || !partnerWindow) {
            return [];
        }

        const ownDesk = calendarDeskTitle(cell.code, participant.desk_group);
        const partnerDesk = calendarDeskTitle(
            partnerCell?.code ?? null,
            partner.desk_group,
        );

        const ownFirst =
            hhmmToMinutes(ownWindow.workStart) <=
            hhmmToMinutes(partnerWindow.workStart);

        if (ownFirst) {
            return [
                workShiftEvent(ownDesk, ownWindow, bidYear, 'am'),
                workShiftEvent(partnerDesk, partnerWindow, bidYear, 'pm'),
            ];
        }

        return [
            workShiftEvent(partnerDesk, partnerWindow, bidYear, 'am'),
            workShiftEvent(ownDesk, ownWindow, bidYear, 'pm'),
        ];
    }

    const window = shiftWindowFromLineStart(participant.start_time);
    if (!window) {
        return [];
    }

    const desk = calendarDeskTitle(cell.code, participant.desk_group);
    return [workShiftEvent(desk, window, bidYear, 'work')];
}

export function buildBuddyBidGoogleCalendarIcs({
    participant,
    partner,
    months,
    planName,
    bidYear,
    timeZone = 'America/Chicago',
}: {
    participant: CalendarParticipantForExport;
    partner: CalendarParticipantForExport | null;
    months: CalendarMonth[];
    planName: string;
    bidYear: number;
    timeZone?: string;
}): string {
    const hasAnyWork =
        participant.start_time != null ||
        (partner?.start_time != null &&
            months.some((month) =>
                month.days.some((day) =>
                    day.participants.some(
                        (p) =>
                            p.participant_id === participant.id &&
                            p.status === 'double',
                    ),
                ),
            ));

    if (!hasAnyWork) {
        return '';
    }

    const now = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//DonkeySwap//Buddy Bid//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeIcsText(`${planName} – ${participant.display_name}`)}`,
        'X-WR-TIMEZONE:' + timeZone,
    ];

    for (const month of months) {
        for (const day of month.days) {
            const drafts = eventsForDay(participant, partner, day, bidYear);
            for (const draft of drafts) {
                pushIcsEvent(
                    lines,
                    draft,
                    day.date,
                    participant.id,
                    timeZone,
                    now,
                );
            }
        }
    }

    if (lines.length <= 7) {
        return '';
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

export function downloadBuddyBidGoogleCalendar(
    ics: string,
    filename: string,
): void {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function slugifyFilenamePart(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
}
