/**
 * Shared helpers for dashboard and admin shift calendars (matches dashboard behavior).
 */

/** Start time in Central, e.g. "6:00 AM" for tooltips and day modal. */
export function formatStartTimeOnly(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

/** Full 24h clock for calendar chips (e.g. 1400, 0600, 1430). */
export function formatStartTime24Full(iso: string): string {
    try {
        const d = new Date(iso);
        const s = d.toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
        });
        return s.replace(':', '');
    } catch {
        return '';
    }
}

/**
 * Clamp overnight shifts to end of start day (local calendar) so month view shows them only on the start day.
 * Same logic as the dashboard `normalizeEventEnd`.
 */
export function normalizeShiftEventEndIso(
    startIso: string,
    endIso: string,
): string {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const startDateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const endDateStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    if (startDateStr !== endDateStr) {
        const endOfStartDay = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            23,
            59,
            59,
            999,
        );
        return endOfStartDay.toISOString();
    }
    return endIso;
}
