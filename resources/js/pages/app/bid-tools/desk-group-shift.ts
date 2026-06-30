export type DeskGroupShift = 'am' | 'pm' | 'mid' | 'relief';

/**
 * D* desk groups = AM, A* = PM, M* = midnight.
 */
export function deskGroupShift(deskGroup: string): DeskGroupShift | null {
    const group = deskGroup.trim().toUpperCase();
    if (!group) {
        return null;
    }

    const letter = group[0];
    if (letter === 'D') {
        return 'am';
    }
    if (letter === 'A') {
        return 'pm';
    }
    if (letter === 'M') {
        return 'mid';
    }

    return null;
}
