export type BuddyDayStatus =
    | 'line_off'
    | 'vacation'
    | 'pull'
    | 'single'
    | 'double'
    | 'buddy_off'
    | 'overlap_pending';

export const BUDDY_STATUS_LABELS: Record<BuddyDayStatus, string> = {
    line_off: 'Off',
    vacation: 'Vac',
    pull: 'Pull',
    single: 'Single',
    double: 'Double',
    buddy_off: 'Buddy off',
    overlap_pending: 'Overlap',
};

export const BUDDY_STATUS_CLASSES: Record<BuddyDayStatus, string> = {
    line_off: 'bg-muted/40 text-muted-foreground',
    vacation: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
    pull: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100',
    single: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
    double: 'bg-amber-200 font-semibold text-amber-950 dark:bg-amber-900 dark:text-amber-50',
    buddy_off:
        'bg-orange-100 text-orange-900 line-through dark:bg-orange-950 dark:text-orange-100',
    overlap_pending:
        'bg-yellow-100 text-yellow-900 ring-1 ring-yellow-400 dark:bg-yellow-950 dark:text-yellow-100',
};
