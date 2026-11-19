/** Standard bid-line shift length (8h 30m), e.g. 1400 → 2230. */
export const BUDDY_SHIFT_WORK_MINUTES = 8 * 60 + 30;

/** Minutes before scheduled start on calendar blocks. */
export const BUDDY_CALENDAR_LEAD_MINUTES = 15;

/** Minutes before scheduled end (leave early) on work / double blocks. */
export const BUDDY_CALENDAR_END_EARLY_MINUTES = 30;

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

export function shiftWindowFromWorkTimes(
    workStart: string | null | undefined,
    workEnd: string | null | undefined,
    endEarlyMinutes = BUDDY_CALENDAR_END_EARLY_MINUTES,
): ShiftWindow | null {
    const normalizedStart = normalizeHhmm(workStart);
    const normalizedEnd = normalizeHhmm(workEnd);
    if (!normalizedStart || !normalizedEnd) {
        return null;
    }

    const eventStart = addMinutesToHhmm(
        normalizedStart,
        -BUDDY_CALENDAR_LEAD_MINUTES,
    );
    const eventEnd = addMinutesToHhmm(normalizedEnd, -endEarlyMinutes);
    const endsNextCalendarDay =
        hhmmToMinutes(normalizedEnd) <= hhmmToMinutes(normalizedStart) ||
        hhmmToMinutes(eventEnd) < hhmmToMinutes(eventStart);

    return {
        workStart: normalizedStart,
        workEnd: normalizedEnd,
        eventStart,
        eventEnd,
        endsNextCalendarDay,
    };
}

export function shiftWindowFromLineStart(
    startTime: string | null | undefined,
): ShiftWindow | null {
    const workStart = normalizeHhmm(startTime);
    if (!workStart) {
        return null;
    }
    const workEnd = addMinutesToHhmm(workStart, BUDDY_SHIFT_WORK_MINUTES);

    return shiftWindowFromWorkTimes(workStart, workEnd);
}

export const TRAINING_AM_WORK = { start: '0700', end: '1500' } as const;
export const TRAINING_PM_WORK = { start: '1200', end: '2000' } as const;

export function shiftWindowForTraining(
    code: string | null | undefined,
): ShiftWindow | null {
    const upper = code?.trim().toUpperCase() ?? '';
    if (upper === 'TAM') {
        return shiftWindowFromWorkTimes(
            TRAINING_AM_WORK.start,
            TRAINING_AM_WORK.end,
            0,
        );
    }
    if (upper === 'TPM') {
        return shiftWindowFromWorkTimes(
            TRAINING_PM_WORK.start,
            TRAINING_PM_WORK.end,
            0,
        );
    }
    return shiftWindowFromWorkTimes(
        TRAINING_AM_WORK.start,
        TRAINING_AM_WORK.end,
        0,
    );
}
