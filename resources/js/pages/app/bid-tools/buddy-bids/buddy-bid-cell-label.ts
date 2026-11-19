import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import { BUDDY_STATUS_LABELS } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';

export function buddyBidStatusCellLabel(status: BuddyDayStatus): string {
    switch (status) {
        case 'line_off':
            return '·';
        case 'buddy_off':
            return 'o';
        case 'overlap_pending':
            return 'O';
        default:
            return BUDDY_STATUS_LABELS[status].charAt(0);
    }
}
