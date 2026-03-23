/**
 * All shift times are stored in UTC.
 * Display in Central (America/Chicago) with optional Zulu (UTC) suffix per user preference.
 */

const CENTRAL_TZ = 'America/Chicago';

export function formatShiftTime(
    utcDate: Date,
    preference: 'central' | 'central_zulu' = 'central',
    options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    },
): string {
    const central = utcDate.toLocaleString('en-US', {
        ...options,
        timeZone: CENTRAL_TZ,
    });
    if (preference === 'central_zulu') {
        const zulu = utcDate.toISOString().slice(11, 16) + 'Z';
        return `${central} CT (${zulu})`;
    }
    return `${central} CT`;
}

export function formatShiftTimeRange(
    startUtc: Date,
    endUtc: Date,
    preference: 'central' | 'central_zulu' = 'central',
): string {
    const start = formatShiftTime(startUtc, preference);
    const end = formatShiftTime(endUtc, preference);
    return `${start} – ${end}`;
}
