import {
    addMinutesToHhmm,
    BUDDY_SHIFT_WORK_MINUTES,
    hhmmToMinutes,
    normalizeHhmm,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-shift-times';
import type { ShiftWindow } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-shift-times';
import {
    BUDDY_CALENDAR_END_EARLY_MINUTES,
    BUDDY_CALENDAR_LEAD_MINUTES,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-shift-times';

export const WORK_MINUTES_MID = 8 * 60;

export const MAX_BUDDY_DOUBLE_OVERLAP_MINUTES = 30;

export function isNonWorkCalendarCode(
    code: string | null | undefined,
): boolean {
    if (!code?.trim()) {
        return true;
    }
    const c = code.trim().toUpperCase();

    return c === 'DXX' || c.includes('RELIEF');
}

/** Desk title: strip leading A/D before G, R, or S (leave M desks as MG1, etc.). */
export function calendarDeskTitle(
    dayCode: string | null,
    deskGroup: string | null,
): string {
    const raw = (dayCode?.trim() || deskGroup?.trim() || '').toUpperCase();
    if (!raw) {
        return 'Work';
    }
    if (/^[AD][GRS]/.test(raw)) {
        return raw.slice(1);
    }

    return raw;
}

export function workStartFromDayCode(
    dayCode: string | null | undefined,
    lineStart: string | null | undefined,
    deskGroup?: string | null,
): string | null {
    if (isNonWorkCalendarCode(dayCode)) {
        return null;
    }

    const c = dayCode?.trim().toUpperCase() ?? '';
    if (c === '') {
        return fallbackLineStart(lineStart, deskGroup);
    }

    const numMatch = c.match(/(\d+)$/);
    if (numMatch) {
        const deskNum = Number.parseInt(numMatch[1], 10);
        if (deskNum === 5) {
            return '0700';
        }
        if (deskNum === 6) {
            return '1500';
        }
    }

    if (c.startsWith('MG') || c.startsWith('MS')) {
        return '2200';
    }
    if (c.startsWith('DR')) {
        return '0700';
    }
    if (c.startsWith('AR')) {
        return '1500';
    }
    if (c.startsWith('DG') || c.startsWith('DS')) {
        return '0600';
    }
    if (c.startsWith('AG') || c.startsWith('AS')) {
        return '1400';
    }

    return fallbackLineStart(lineStart, deskGroup);
}

export function workDurationMinutes(
    dayCode: string | null | undefined,
    workStart: string | null,
): number {
    const c = dayCode?.trim().toUpperCase() ?? '';
    if (c.startsWith('MG') || c.startsWith('MS')) {
        return WORK_MINUTES_MID;
    }
    if (workStart === '2200') {
        return WORK_MINUTES_MID;
    }

    return BUDDY_SHIFT_WORK_MINUTES;
}

export function shiftWindowForDayCode(
    dayCode: string | null | undefined,
    lineStart: string | null | undefined,
    deskGroup?: string | null,
): ShiftWindow | null {
    const workStart = workStartFromDayCode(dayCode, lineStart, deskGroup);
    if (!workStart) {
        return null;
    }

    const duration = workDurationMinutes(dayCode, workStart);
    const workEnd = addMinutesToHhmm(workStart, duration);
    const isMidnight = workStart === '2200' && duration === WORK_MINUTES_MID;
    const eventStart = addMinutesToHhmm(
        workStart,
        -BUDDY_CALENDAR_LEAD_MINUTES,
    );
    const eventEnd = isMidnight
        ? workEnd
        : addMinutesToHhmm(workEnd, -BUDDY_CALENDAR_END_EARLY_MINUTES);
    const endsNextCalendarDay =
        isMidnight || hhmmToMinutes(workEnd) <= hhmmToMinutes(workStart);

    return {
        workStart,
        workEnd,
        eventStart,
        eventEnd,
        endsNextCalendarDay,
    };
}

export function overlapMinutes(
    startA: number,
    durationA: number,
    startB: number,
    durationB: number,
): number {
    const endA = startA + durationA;
    const endB = startB + durationB;
    const overlapStart = Math.max(startA, startB);
    const overlapEnd = Math.min(endA, endB);

    return Math.max(0, overlapEnd - overlapStart);
}

export function shiftsCanBuddyDouble(
    startA: string,
    durationA: number,
    startB: string,
    durationB: number,
): boolean {
    return (
        overlapMinutes(
            hhmmToMinutes(startA),
            durationA,
            hhmmToMinutes(startB),
            durationB,
        ) <= MAX_BUDDY_DOUBLE_OVERLAP_MINUTES
    );
}

function fallbackLineStart(
    lineStart: string | null | undefined,
    deskGroup?: string | null,
): string | null {
    const normalized = normalizeHhmm(lineStart);
    if (normalized !== null && normalized !== '2200') {
        return normalized;
    }

    const group = deskGroup?.trim().toUpperCase() ?? '';
    if (normalized === '2200' || group.startsWith('M')) {
        return '2200';
    }

    return normalized;
}
