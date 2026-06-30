import {
    deskGroupShift
    
} from '@/pages/app/bid-tools/desk-group-shift';
import type {DeskGroupShift} from '@/pages/app/bid-tools/desk-group-shift';

export type LineShift = DeskGroupShift | 'other';

export function normalizeLineShift(
    shift: string | null | undefined,
): LineShift | null {
    if (
        shift === 'am' ||
        shift === 'pm' ||
        shift === 'mid' ||
        shift === 'relief'
    ) {
        return shift;
    }

    return null;
}

export function lineShiftLabel(shift: LineShift): string {
    switch (shift) {
        case 'am':
            return 'AM';
        case 'pm':
            return 'PM';
        case 'mid':
            return 'Mid';
        case 'relief':
            return 'Relief';
        default:
            return 'Other';
    }
}

export { deskGroupShift, type DeskGroupShift };
