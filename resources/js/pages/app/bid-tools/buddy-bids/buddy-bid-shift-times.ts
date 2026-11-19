/** Standard bid-line shift length (8h 30m), e.g. 1400 → 2230. */
export const BUDDY_SHIFT_WORK_MINUTES = 8 * 60 + 30;

/** Minutes before/after shift shown on Google Calendar import. */
export const BUDDY_CALENDAR_EDGE_BUFFER_MINUTES = 15;

export function normalizeHhmm(raw: string | null | undefined): string | null {
    if (!raw) {
        return null;
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 3) {
        return null;
    }
    const padded = digits.padStart(4, '0').slice(-4);
    const h = Number.parseInt(padded.slice(0, 2), 10);
    const m = Number.parseInt(padded.slice(2, 4), 10);
    if (h > 23 || m > 59) {
        return null;
    }
    return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(hhmm: string): number {
    const h = Number.parseInt(hhmm.slice(0, 2), 10);
    const m = Number.parseInt(hhmm.slice(2, 4), 10);
    return h * 60 + m;
}

export function minutesToHhmm(totalMinutes: number): string {
    const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

export function addMinutesToHhmm(hhmm: string, delta: number): string {
    return minutesToHhmm(hhmmToMinutes(hhmm) + delta);
}

export type ShiftWindow = {
    workStart: string;
    workEnd: string;
    eventStart: string;
    eventEnd: string;
    endsNextCalendarDay: boolean;
};

export function shiftWindowFromLineStart(
    startTime: string | null | undefined,
): ShiftWindow | null {
    const workStart = normalizeHhmm(startTime);
    if (!workStart) {
        return null;
    }
    const workEnd = addMinutesToHhmm(workStart, BUDDY_SHIFT_WORK_MINUTES);
    const eventStart = addMinutesToHhmm(
        workStart,
        -BUDDY_CALENDAR_EDGE_BUFFER_MINUTES,
    );
    const eventEnd = addMinutesToHhmm(
        workEnd,
        -BUDDY_CALENDAR_EDGE_BUFFER_MINUTES,
    );
    const endsNextCalendarDay =
        hhmmToMinutes(workEnd) <= hhmmToMinutes(workStart);

    return {
        workStart,
        workEnd,
        eventStart,
        eventEnd,
        endsNextCalendarDay,
    };
}
