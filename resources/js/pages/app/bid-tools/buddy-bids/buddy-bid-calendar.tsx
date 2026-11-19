import { useMemo, useState } from 'react';
import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import {
    BUDDY_STATUS_CLASSES,
    BUDDY_STATUS_LABELS,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import {
    nextOverlapAssignmentOnClick,
    type OverlapDayAssignment,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-overlap-assignment';

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
    overlap_mode: string | null;
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

function BuddyBidMonthTable({
    month,
    participantOrder,
    assignmentByDate,
    singlesAfterClear,
    onAssignOverlap,
    readOnly = false,
    printLayout = false,
}: {
    month: CalendarMonth;
    participantOrder: CalendarParticipant[];
    assignmentByDate: Record<string, OverlapDayAssignment>;
    singlesAfterClear: Record<string, number | null>;
    onAssignOverlap?: (
        date: string,
        assignment: OverlapDayAssignment,
        clearedDoubleParticipantId?: number,
    ) => void;
    readOnly?: boolean;
    printLayout?: boolean;
}) {
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
                                                onClick={(event) => {
                                                    if (
                                                        !day.is_compatible_overlap ||
                                                        !onAssignOverlap
                                                    ) {
                                                        return;
                                                    }

                                                    const current =
                                                        assignmentByDate[
                                                            day.date
                                                        ] ?? {
                                                            overlap_mode:
                                                                'pending' as const,
                                                            double_participant_id:
                                                                null,
                                                        };

                                                    const modifierKey =
                                                        event.shiftKey ||
                                                        event.altKey ||
                                                        event.ctrlKey;
                                                    const next =
                                                        nextOverlapAssignmentOnClick(
                                                            current,
                                                            participant.id,
                                                            modifierKey,
                                                            singlesAfterClear[
                                                                day.date
                                                            ] ?? null,
                                                        );
                                                    const clearedDouble =
                                                        current.overlap_mode ===
                                                            'double' &&
                                                        current.double_participant_id ===
                                                            participant.id &&
                                                        next.overlap_mode ===
                                                            'pending';

                                                    onAssignOverlap(
                                                        day.date,
                                                        next,
                                                        clearedDouble
                                                            ? participant.id
                                                            : undefined,
                                                    );
                                                }}
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
    assignmentByDate,
    onAssignOverlap,
    readOnly = false,
    printLayout = false,
}: {
    months: CalendarMonth[];
    participants: CalendarParticipant[];
    linesCanDouble: boolean;
    shiftPairing: string | null;
    assignmentByDate?: Record<string, OverlapDayAssignment>;
    onAssignOverlap?: (date: string, assignment: OverlapDayAssignment) => void;
    readOnly?: boolean;
    printLayout?: boolean;
}) {
    const participantOrder = useMemo(
        () => [...participants].sort((a, b) => a.slot - b.slot),
        [participants],
    );

    const assignments =
        assignmentByDate ?? ({} as Record<string, OverlapDayAssignment>);

    const [singlesAfterClear, setSinglesAfterClear] = useState<
        Record<string, number | null>
    >({});

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
                        On overlap days (yellow): click a buddy for double (D);
                        click the same buddy again for open (O), then once more
                        for both singles (S). Click the other buddy to switch
                        doubles in one click. Shift+click also sets singles (S).
                    </p>
                </div>
            )}

            <div className={printLayout ? '' : 'space-y-8'}>
                {months.map((month) => (
                    <BuddyBidMonthTable
                        key={month.key}
                        month={month}
                        participantOrder={participantOrder}
                        assignmentByDate={assignments}
                        singlesAfterClear={singlesAfterClear}
                        onAssignOverlap={
                            onAssignOverlap
                                ? (
                                      date,
                                      assignment,
                                      clearedDoubleParticipantId,
                                  ) => {
                                      onAssignOverlap(date, assignment);
                                      setSinglesAfterClear((current) => {
                                          const next = { ...current };

                                          if (clearedDoubleParticipantId) {
                                              next[date] =
                                                  clearedDoubleParticipantId;
                                          } else if (
                                              assignment.overlap_mode !==
                                              'pending'
                                          ) {
                                              delete next[date];
                                          }

                                          return next;
                                      });
                                  }
                                : undefined
                        }
                        readOnly={readOnly}
                        printLayout={printLayout}
                    />
                ))}
            </div>
        </div>
    );
}
