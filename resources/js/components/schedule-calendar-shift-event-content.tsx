import { DollarSign, Handshake, Plane, Repeat } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    formatStartTime24Full,
    formatStartTimeOnly,
} from '@/lib/schedule-calendar-shift-display';

export type ScheduleCalendarShiftPost = { type: string };

export type ScheduleCalendarShiftEventContentProps = {
    /** Primary line: position / desk name (dashboard: `position_name`). */
    positionLabel: string;
    /** Optional second line (e.g. user name when viewing all users, or workgroup). */
    subtitle?: string;
    startIso: string;
    endIso: string;
    regulatory?: boolean;
    posts?: ScheduleCalendarShiftPost[];
    pendingIncoming?: boolean;
    isNewShift?: boolean;
    actionRequired?: boolean;
    /**
     * When set, replaces default blue/muted surface classes (e.g. per-user colors on Others boards).
     * Pending-incoming styling still wins when `pendingIncoming` is true.
     */
    surfaceClassName?: string;
};

/**
 * Shift chip content for FullCalendar — matches the dashboard calendar shift styling.
 */
export function ScheduleCalendarShiftEventContent({
    positionLabel,
    subtitle,
    startIso,
    endIso,
    regulatory,
    posts = [],
    pendingIncoming = false,
    isNewShift = false,
    actionRequired = false,
    surfaceClassName,
}: ScheduleCalendarShiftEventContentProps) {
    const time24Full = formatStartTime24Full(startIso);
    const isPast = new Date(endIso) < new Date();
    const badges: ReactNode[] = [];
    if (regulatory) {
        badges.push(
            <span
                key="r"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                title="Regulatory"
            />,
        );
    }
    if (posts.some((x) => x.type === 'trade')) {
        badges.push(
            <Handshake
                key="t"
                className="size-3 shrink-0 text-blue-600 dark:text-blue-400"
                title="Trade"
            />,
        );
    }
    if (posts.some((x) => x.type === 'time_trade')) {
        badges.push(
            <Repeat
                key="tt"
                strokeWidth={2.5}
                className="size-3 shrink-0 text-blue-600 dark:text-blue-400"
                title="Time trade"
            />,
        );
    }
    if (posts.some((x) => x.type === 'cash')) {
        badges.push(
            <DollarSign
                key="c"
                className="size-3 shrink-0 text-green-600 dark:text-green-400"
                title="Giveaway"
            />,
        );
    }
    if (posts.some((x) => x.type === 'flight_follow')) {
        badges.push(
            <Plane
                key="f"
                className="size-3 shrink-0 text-purple-600 dark:text-purple-400"
                title="Flight Follow"
            />,
        );
    }
    if (actionRequired) {
        badges.push(
            <span
                key="action"
                className="shrink-0 rounded bg-amber-500/90 px-1 text-[10px] font-medium text-white dark:bg-amber-600 dark:text-amber-100"
                title="Action required — respond to offer"
            >
                Action
            </span>,
        );
    }
    if (isNewShift) {
        badges.push(
            <span
                key="new"
                className="shrink-0 rounded bg-green-600 px-1 text-[10px] font-medium text-white dark:bg-green-500 dark:text-green-950"
                title="New shift — your response was accepted. Please check workzone to ensure the change has been made properly."
            >
                New
            </span>,
        );
    }

    const defaultSurface = isPast
        ? 'bg-muted text-muted-foreground opacity-70'
        : 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100';
    const surface = pendingIncoming
        ? 'border border-dashed border-amber-500/60 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
        : surfaceClassName
          ? `${surfaceClassName} ${isPast ? 'opacity-70' : ''}`
          : defaultSurface;

    return (
        <div
            className={`flex w-full min-w-0 overflow-hidden rounded-lg px-2 py-0.5 text-xs ${surface} min-h-[3.5rem] flex-col items-center gap-0.5 py-1.5 sm:min-h-0 sm:flex-row sm:items-center sm:py-0.5`}
            title={`${positionLabel} ${formatStartTimeOnly(startIso)}`}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 truncate text-center sm:text-left">
                <span className="truncate font-medium">{positionLabel}</span>
                {subtitle ? (
                    <span className="truncate text-[10px] opacity-80">
                        {subtitle}
                    </span>
                ) : null}
                {time24Full ? (
                    <span className="text-[10px] opacity-90">{time24Full}</span>
                ) : null}
            </div>
            <div className="flex shrink-0 items-center justify-center gap-0.5 sm:ml-auto sm:justify-end">
                {pendingIncoming && (
                    <span
                        className="rounded bg-amber-200/80 px-1 text-[10px] font-medium text-amber-900 dark:bg-amber-800/50 dark:text-amber-100"
                        title="Pending — waiting for response"
                    >
                        Pending
                    </span>
                )}
                {badges.length > 0 && (
                    <span className="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
                        {badges}
                    </span>
                )}
            </div>
        </div>
    );
}
