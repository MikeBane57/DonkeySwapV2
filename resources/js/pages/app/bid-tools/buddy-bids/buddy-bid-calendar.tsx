import { useMemo } from 'react';
import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import {
    BUDDY_STATUS_CLASSES,
    BUDDY_STATUS_LABELS,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';

type ParticipantCell = {
    participant_id: number;
    status: BuddyDayStatus;
    line_works: boolean;
    code: string | null;
};

type CalendarDay = {
    date: string;
    day_of_month: number;
    is_compatible_overlap: boolean;
    double_participant_id: number | null;
    participants: ParticipantCell[];
};

type CalendarMonth = {
    key: string;
    label: string;
    days: CalendarDay[];
};

type CalendarParticipant = {
    id: number;
    slot: number;
    display_name: string;
};

function cycleDoubleAssignment(
    day: CalendarDay,
    participantIds: number[],
    onAssignOverlap: (date: string, doubleParticipantId: number | null) => void,
) {
    if (!day.is_compatible_overlap) {
        return;
    }

    const current = day.double_participant_id;

    if (current === null) {
        onAssignOverlap(day.date, participantIds[0] ?? null);
        return;
    }

    const currentIndex = participantIds.indexOf(current);
    if (currentIndex === participantIds.length - 1) {
        onAssignOverlap(day.date, null);
        return;
    }

    onAssignOverlap(day.date, participantIds[currentIndex + 1] ?? null);
}

function BuddyBidMonthTable({
    month,
    participantOrder,
    onAssignOverlap,
    readOnly = false,
    printLayout = false,
}: {
    month: CalendarMonth;
    participantOrder: CalendarParticipant[];
    onAssignOverlap?: (
        date: string,
        doubleParticipantId: number | null,
    ) => void;
    readOnly?: boolean;
    printLayout?: boolean;
}) {
    const participantIds = participantOrder.map((p) => p.id);
    const tableClass = printLayout
        ? 'bid-tools-print-table buddy-bid-print-calendar w-full border-collapse'
        : 'w-full min-w-[48rem] border-collapse text-[10px]';

    return (
        <section
            className={printLayout ? 'buddy-bid-print-month' : 'space-y-2'}
        >
            <h3
                className={
                    printLayout
                        ? 'buddy-bid-print-month-title text-[7pt] font-semibold'
                        : 'text-sm font-medium'
                }
            >
                {month.label}
            </h3>
            <div
                className={
                    printLayout
                        ? ''
                        : 'overflow-x-auto rounded-lg border border-sidebar-border/70'
                }
            >
                <table className={tableClass}>
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="sticky left-0 z-10 bg-muted/30 px-2 py-1 text-left font-medium">
                                Buddy
                            </th>
                            {month.days.map((day) => (
                                <th
                                    key={day.date}
                                    className={`px-0.5 py-1 text-center font-medium ${
                                        day.is_compatible_overlap
                                            ? 'bg-yellow-50 dark:bg-yellow-950/30'
                                            : ''
                                    }`}
                                >
                                    {day.day_of_month}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {participantOrder.map((participant) => (
                            <tr
                                key={participant.id}
                                className="border-b border-sidebar-border/40"
                            >
                                <td className="sticky left-0 z-10 bg-background px-2 py-1 font-medium whitespace-nowrap">
                                    {participant.display_name}
                                </td>
                                {month.days.map((day) => {
                                    const cell = day.participants.find(
                                        (p) =>
                                            p.participant_id === participant.id,
                                    );
                                    const status = cell?.status ?? 'line_off';
                                    const label =
                                        status === 'line_off'
                                            ? '·'
                                            : BUDDY_STATUS_LABELS[
                                                  status
                                              ].charAt(0);

                                    if (readOnly) {
                                        return (
                                            <td
                                                key={`${participant.id}-${day.date}`}
                                                className="p-0.5 text-center"
                                            >
                                                <span
                                                    title={`${day.date}: ${BUDDY_STATUS_LABELS[status]}`}
                                                    className={`buddy-bid-status-cell inline-flex h-5 w-full min-w-[1.1rem] items-center justify-center rounded px-0.5 ${BUDDY_STATUS_CLASSES[status]}`}
                                                >
                                                    {label}
                                                </span>
                                            </td>
                                        );
                                    }

                                    return (
                                        <td
                                            key={`${participant.id}-${day.date}`}
                                            className="p-0.5 text-center"
                                        >
                                            <button
                                                type="button"
                                                title={`${day.date}: ${BUDDY_STATUS_LABELS[status]}`}
                                                className={`h-6 w-full min-w-[1.4rem] rounded px-0.5 ${BUDDY_STATUS_CLASSES[status]} ${
                                                    day.is_compatible_overlap
                                                        ? 'cursor-pointer hover:ring-2 hover:ring-yellow-500'
                                                        : 'cursor-default'
                                                }`}
                                                onClick={() =>
                                                    cycleDoubleAssignment(
                                                        day,
                                                        participantIds,
                                                        onAssignOverlap!,
                                                    )
                                                }
                                            >
                                                {label}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export function BuddyBidCalendar({
    months,
    participants,
    linesCanDouble,
    shiftPairing,
    onAssignOverlap,
    readOnly = false,
    printLayout = false,
}: {
    months: CalendarMonth[];
    participants: CalendarParticipant[];
    linesCanDouble: boolean;
    shiftPairing: string | null;
    onAssignOverlap?: (
        date: string,
        doubleParticipantId: number | null,
    ) => void;
    readOnly?: boolean;
    printLayout?: boolean;
}) {
    const participantOrder = useMemo(
        () => [...participants].sort((a, b) => a.slot - b.slot),
        [participants],
    );

    if (months.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No calendar data for this bid year.
            </p>
        );
    }

    return (
        <div
            className={
                printLayout ? 'buddy-bid-print-calendar-stack' : 'space-y-6'
            }
        >
            {!readOnly && (
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                        {linesCanDouble
                            ? `Compatible shift pairing: ${shiftPairing ?? 'yes'}`
                            : 'Selected lines cannot form legal doubles (need different start-time buckets, e.g. AM + PM).'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Click highlighted overlap days to cycle: User A double →
                        User B double → clear.
                    </p>
                </div>
            )}

            <div className={printLayout ? '' : 'space-y-8'}>
                {months.map((month) => (
                    <BuddyBidMonthTable
                        key={month.key}
                        month={month}
                        participantOrder={participantOrder}
                        onAssignOverlap={onAssignOverlap}
                        readOnly={readOnly}
                        printLayout={printLayout}
                    />
                ))}
            </div>
        </div>
    );
}
