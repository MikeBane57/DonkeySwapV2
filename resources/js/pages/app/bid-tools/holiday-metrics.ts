export type KeyHolidayDate = {
    id: string;
    label: string;
    short_label: string;
    off: boolean;
    days_off_before?: number;
    days_off_after?: number;
};

export type KeyHolidayGroup = {
    off: number;
    total: number;
    anchor_label?: string | null;
    anchor_off?: boolean;
    days_off_before?: number;
    days_off_after?: number;
    dates?: KeyHolidayDate[];
};

export type KeyHolidays = {
    christmas?: KeyHolidayGroup;
    thanksgiving?: KeyHolidayGroup;
    july_4?: KeyHolidayGroup;
};

export type WeekendMetrics = {
    fri_off: number;
    sat_off: number;
    sun_off: number;
    fri_sat_sun_all_off: number;
    sat_sun_both_off: number;
};

export type LineMetrics = {
    holidays_off: number;
    key_holidays?: KeyHolidays;
    fri_off: number;
    sat_off: number;
    sun_off: number;
    fri_sat_sun_all_off: number;
    sat_sun_both_off: number;
    sept_feb?: WeekendMetrics;
};

function formatDaysOffCount(
    count: number,
    position: 'before' | 'after',
): string {
    const noun = count === 1 ? 'day' : 'days';

    return `${count} ${noun} off ${position}`;
}

export function dateOffContextLabel(date: KeyHolidayDate): string | null {
    if (!date.off) {
        return null;
    }

    const before = date.days_off_before ?? 0;
    const after = date.days_off_after ?? 0;

    if (before > 0 && after > 0) {
        return 'Middle of days off';
    }

    const parts: string[] = [];
    if (before > 0) {
        parts.push(formatDaysOffCount(before, 'before'));
    }
    if (after > 0) {
        parts.push(formatDaysOffCount(after, 'after'));
    }

    if (parts.length === 0) {
        return null;
    }

    return parts.join(' · ');
}

function statusFromDates(dates: KeyHolidayDate[]): string {
    return dates
        .map((date) => `${date.short_label} ${date.off ? 'off' : 'work'}`)
        .join(' · ');
}

export function keyHolidayLabel(group: KeyHolidayGroup | undefined): string {
    if (!group || group.total === 0) {
        return '—';
    }

    if (group.dates && group.dates.length > 0) {
        if (group.off === 0) {
            return group.dates.length === 1 ? 'Work' : statusFromDates(group.dates);
        }
        if (group.off === group.total) {
            return 'Off';
        }

        return statusFromDates(group.dates);
    }

    if (group.off === group.total) {
        return 'Off';
    }
    if (group.off === 0) {
        return '—';
    }

    return `${group.off}/${group.total}`;
}

export function keyHolidayContextLines(
    group: KeyHolidayGroup | undefined,
): string[] {
    if (!group) {
        return [];
    }

    if (group.dates && group.dates.length > 0) {
        const lines: string[] = [];

        for (const date of group.dates) {
            const context = dateOffContextLabel(date);
            if (!context) {
                continue;
            }

            lines.push(`${date.label} with ${context.toLowerCase()}`);
        }

        return lines;
    }

    const legacy = keyHolidayLegacyContextLabel(group);

    return legacy ? [legacy] : [];
}

function keyHolidayLegacyContextLabel(
    group: KeyHolidayGroup,
): string | null {
    if (!group.anchor_off) {
        return null;
    }

    const before = group.days_off_before ?? 0;
    const after = group.days_off_after ?? 0;

    if (before > 0 && after > 0) {
        return 'Middle of days off';
    }

    const parts: string[] = [];
    if (before > 0) {
        parts.push(formatDaysOffCount(before, 'before'));
    }
    if (after > 0) {
        parts.push(formatDaysOffCount(after, 'after'));
    }

    if (parts.length === 0) {
        return null;
    }

    if (group.anchor_label) {
        return `${group.anchor_label} with ${parts.join(' and ')}`;
    }

    return parts.join(' · ');
}

/** @deprecated Use keyHolidayContextLines */
export function keyHolidayContextLabel(
    group: KeyHolidayGroup | undefined,
): string | null {
    const lines = keyHolidayContextLines(group);

    return lines[0] ?? null;
}

export function formatWeekendMetrics(metrics: WeekendMetrics): string {
    return `${metrics.fri_off}/${metrics.sat_off}/${metrics.sun_off}`;
}

export function formatWeekendBlockMetrics(metrics: WeekendMetrics): string {
    return `F–Su ${metrics.fri_sat_sun_all_off} · Sa–Su ${metrics.sat_sun_both_off}`;
}

export function keyHolidayPrintLabel(
    group: KeyHolidayGroup | undefined,
): string {
    const label = keyHolidayLabel(group);
    const contexts = keyHolidayContextLines(group);

    if (contexts.length === 0) {
        return label;
    }

    return `${label} (${contexts.join('; ')})`;
}

export function weekendMetricsPrintLabel(metrics: LineMetrics): string {
    const fullYear = `${formatWeekendMetrics(metrics)}; ${formatWeekendBlockMetrics(metrics)}`;
    const septFeb = metrics.sept_feb;

    if (!septFeb) {
        return fullYear;
    }

    return `${fullYear}; Sep–Feb ${formatWeekendMetrics(septFeb)}`;
}
