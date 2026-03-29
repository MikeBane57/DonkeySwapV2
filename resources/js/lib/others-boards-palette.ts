/** Distinct surfaces for overlaying coworkers on the Others boards calendar (cycles by user). */
export const OTHERS_BOARD_PALETTE = [
    {
        shift: 'border border-teal-500/35 bg-teal-100 text-teal-950 dark:bg-teal-950/45 dark:text-teal-50',
        timeOff:
            'bg-teal-200/55 text-teal-950 dark:bg-teal-900/40 dark:text-teal-100',
        lfw: 'border border-dashed border-teal-500/50 bg-teal-50/90 text-teal-950 dark:border-teal-400/45 dark:bg-teal-950/35 dark:text-teal-50',
        lfwPost:
            'border-2 border-teal-600/55 bg-teal-200/70 text-teal-950 dark:border-teal-400/50 dark:bg-teal-900/45 dark:text-teal-50',
    },
    {
        shift: 'border border-violet-500/35 bg-violet-100 text-violet-950 dark:bg-violet-950/45 dark:text-violet-50',
        timeOff:
            'bg-violet-200/55 text-violet-950 dark:bg-violet-900/40 dark:text-violet-100',
        lfw: 'border border-dashed border-violet-500/50 bg-violet-50/90 text-violet-950 dark:border-violet-400/45 dark:bg-violet-950/35 dark:text-violet-50',
        lfwPost:
            'border-2 border-violet-600/55 bg-violet-200/70 text-violet-950 dark:border-violet-400/50 dark:bg-violet-900/45 dark:text-violet-50',
    },
    {
        shift: 'border border-amber-500/35 bg-amber-100 text-amber-950 dark:bg-amber-950/45 dark:text-amber-50',
        timeOff:
            'bg-amber-200/55 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100',
        lfw: 'border border-dashed border-amber-500/50 bg-amber-50/90 text-amber-950 dark:border-amber-400/45 dark:bg-amber-950/35 dark:text-amber-50',
        lfwPost:
            'border-2 border-amber-600/55 bg-amber-200/70 text-amber-950 dark:border-amber-400/50 dark:bg-amber-900/45 dark:text-amber-50',
    },
    {
        shift: 'border border-rose-500/35 bg-rose-100 text-rose-950 dark:bg-rose-950/45 dark:text-rose-50',
        timeOff:
            'bg-rose-200/55 text-rose-950 dark:bg-rose-900/40 dark:text-rose-100',
        lfw: 'border border-dashed border-rose-500/50 bg-rose-50/90 text-rose-950 dark:border-rose-400/45 dark:bg-rose-950/35 dark:text-rose-50',
        lfwPost:
            'border-2 border-rose-600/55 bg-rose-200/70 text-rose-950 dark:border-rose-400/50 dark:bg-rose-900/45 dark:text-rose-50',
    },
    {
        shift: 'border border-cyan-500/35 bg-cyan-100 text-cyan-950 dark:bg-cyan-950/45 dark:text-cyan-50',
        timeOff:
            'bg-cyan-200/55 text-cyan-950 dark:bg-cyan-900/40 dark:text-cyan-100',
        lfw: 'border border-dashed border-cyan-500/50 bg-cyan-50/90 text-cyan-950 dark:border-cyan-400/45 dark:bg-cyan-950/35 dark:text-cyan-50',
        lfwPost:
            'border-2 border-cyan-600/55 bg-cyan-200/70 text-cyan-950 dark:border-cyan-400/50 dark:bg-cyan-900/45 dark:text-cyan-50',
    },
    {
        shift: 'border border-fuchsia-500/35 bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950/45 dark:text-fuchsia-50',
        timeOff:
            'bg-fuchsia-200/55 text-fuchsia-950 dark:bg-fuchsia-900/40 dark:text-fuchsia-100',
        lfw: 'border border-dashed border-fuchsia-500/50 bg-fuchsia-50/90 text-fuchsia-950 dark:border-fuchsia-400/45 dark:bg-fuchsia-950/35 dark:text-fuchsia-50',
        lfwPost:
            'border-2 border-fuchsia-600/55 bg-fuchsia-200/70 text-fuchsia-950 dark:border-fuchsia-400/50 dark:bg-fuchsia-900/45 dark:text-fuchsia-50',
    },
    {
        shift: 'border border-lime-500/35 bg-lime-100 text-lime-950 dark:bg-lime-950/45 dark:text-lime-50',
        timeOff:
            'bg-lime-200/55 text-lime-950 dark:bg-lime-900/40 dark:text-lime-100',
        lfw: 'border border-dashed border-lime-500/50 bg-lime-50/90 text-lime-950 dark:border-lime-400/45 dark:bg-lime-950/35 dark:text-lime-50',
        lfwPost:
            'border-2 border-lime-600/55 bg-lime-200/70 text-lime-950 dark:border-lime-400/50 dark:bg-lime-900/45 dark:text-lime-50',
    },
    {
        shift: 'border border-sky-500/35 bg-sky-100 text-sky-950 dark:bg-sky-950/45 dark:text-sky-50',
        timeOff:
            'bg-sky-200/55 text-sky-950 dark:bg-sky-900/40 dark:text-sky-100',
        lfw: 'border border-dashed border-sky-500/50 bg-sky-50/90 text-sky-950 dark:border-sky-400/45 dark:bg-sky-950/35 dark:text-sky-50',
        lfwPost:
            'border-2 border-sky-600/55 bg-sky-200/70 text-sky-950 dark:border-sky-400/50 dark:bg-sky-900/45 dark:text-sky-50',
    },
] as const;

/** Solid dots for the sidebar / legend (matches palette order). */
export const OTHERS_BOARD_LEGEND_HEX = [
    '#14b8a6',
    '#8b5cf6',
    '#f59e0b',
    '#f43f5e',
    '#06b6d4',
    '#d946ef',
    '#84cc16',
    '#0ea5e9',
] as const;

/** Stable color per user based on sort order of the current selection (not click order). */
export function colorIndexForUserId(
    userId: number,
    selectedIds: number[],
): number {
    const sorted = [...selectedIds].sort((a, b) => a - b);
    const idx = sorted.indexOf(userId);
    if (idx < 0) return 0;
    return idx % OTHERS_BOARD_PALETTE.length;
}
