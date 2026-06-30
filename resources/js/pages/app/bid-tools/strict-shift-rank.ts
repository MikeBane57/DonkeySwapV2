export type StrictShiftClass = 'am' | 'pm' | 'mid' | 'relief';

export const STRICT_SHIFT_RANK_DEFAULT: StrictShiftClass[] = [
    'am',
    'pm',
    'mid',
    'relief',
];

export const STRICT_SHIFT_LABELS: Record<StrictShiftClass, string> = {
    am: 'AM (06/07)',
    pm: 'PM (14/15)',
    mid: 'Mid (22)',
    relief: 'Relief',
};

export function normalizeStrictShiftRank(raw: unknown): StrictShiftClass[] {
    const allowed: StrictShiftClass[] = ['am', 'pm', 'mid', 'relief'];
    if (!Array.isArray(raw)) {
        return [...STRICT_SHIFT_RANK_DEFAULT];
    }

    const order: StrictShiftClass[] = [];
    for (const item of raw) {
        if (
            (item === 'am' ||
                item === 'pm' ||
                item === 'mid' ||
                item === 'relief') &&
            !order.includes(item)
        ) {
            order.push(item);
        }
    }

    for (const shift of allowed) {
        if (!order.includes(shift)) {
            order.push(shift);
        }
    }

    return order;
}
