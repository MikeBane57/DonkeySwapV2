import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import {
    shiftWindowFromLineStart,
    type ShiftWindow,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-shift-times';

type CalendarMonth = {
    days: {
        date: string;
        participants: {
            participant_id: number;
            status: BuddyDayStatus;
            code: string | null;
        }[];
    }[];
};

type CalendarParticipant = {
    id: number;
    display_name: string;
    desk_group: string | null;
    start_time: string | null;
};

const GOOGLE_BUSY_STATUSES: BuddyDayStatus[] = [
    'single',
    'double',
    'training',
    'overlap_pending',
];

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

function hhmmToMinutes(hhmm: string): number {
    const h = Number.parseInt(hhmm.slice(0, 2), 10);
    const m = Number.parseInt(hhmm.slice(2, 4), 10);
    return h * 60 + m;
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

function deskLabel(code: string | null, deskGroup: string | null): string {
    const fromCode = code?.trim();
    if (fromCode) {
        return fromCode;
    }
    const fromGroup = deskGroup?.trim();
    if (fromGroup) {
        return fromGroup;
    }
    return 'Work';
}

function eventSummary(desk: string, window: ShiftWindow): string {
    return `${desk} ${window.eventStart}-${window.eventEnd}`;
}

export function buildBuddyBidGoogleCalendarIcs({
    participant,
    months,
    planName,
    bidYear,
    timeZone = 'America/Chicago',
}: {
    participant: CalendarParticipant;
    months: CalendarMonth[];
    planName: string;
    bidYear: number;
    timeZone?: string;
}): string {
    const shiftWindow = shiftWindowFromLineStart(participant.start_time);
    if (!shiftWindow) {
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
            const cell = day.participants.find(
                (p) => p.participant_id === participant.id,
            );
            if (!cell || !GOOGLE_BUSY_STATUSES.includes(cell.status)) {
                continue;
            }

            const desk = deskLabel(cell.code, participant.desk_group);
            const summary = eventSummary(desk, shiftWindow);
            const { start, end } = eventDtEnd(day.date, shiftWindow);
            const uid = `buddy-bid-${participant.id}-${day.date}@donkeyswap`;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${now}`);
            lines.push(`DTSTART;TZID=${timeZone}:${start}`);
            lines.push(`DTEND;TZID=${timeZone}:${end}`);
            lines.push(`SUMMARY:${escapeIcsText(summary)}`);
            lines.push(
                `DESCRIPTION:${escapeIcsText(`Buddy bid ${bidYear} · line shift (busy block −15 min each end)`)}`,
            );
            lines.push('TRANSP:OPAQUE');
            lines.push('STATUS:CONFIRMED');
            lines.push('END:VEVENT');
        }
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
