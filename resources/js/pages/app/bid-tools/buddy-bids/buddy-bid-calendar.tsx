import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function BuddyBidCalendar({
    months,
    participants,
    linesCanDouble,
    shiftPairing,
    onAssignOverlap,
}: {
    months: CalendarMonth[];
    participants: CalendarParticipant[];
    linesCanDouble: boolean;
    shiftPairing: string | null;
    onAssignOverlap: (date: string, doubleParticipantId: number | null) => void;
}) {
    const [monthIndex, setMonthIndex] = useState(0);
    const month = months[monthIndex];

    const participantOrder = useMemo(
        () => [...participants].sort((a, b) => a.slot - b.slot),
        [participants],
    );

    if (!month) {
        return (
            <p className="text-sm text-muted-foreground">
                No calendar data for this bid year.
            </p>
        );
    }

    const cycleAssignment = (day: CalendarDay) => {
        if (!day.is_compatible_overlap) {
            return;
        }

        const ids = participantOrder.map((p) => p.id);
        const current = day.double_participant_id;

        if (current === null) {
            onAssignOverlap(day.date, ids[0] ?? null);
            return;
        }

        const currentIndex = ids.indexOf(current);
        if (currentIndex === ids.length - 1) {
            onAssignOverlap(day.date, null);
            return;
        }

        onAssignOverlap(day.date, ids[currentIndex + 1] ?? null);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={monthIndex <= 0}
                        onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[10rem] text-center text-sm font-medium">
                        {month.label}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={monthIndex >= months.length - 1}
                        onClick={() =>
                            setMonthIndex((i) =>
                                Math.min(months.length - 1, i + 1),
                            )
                        }
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {linesCanDouble
                        ? `Compatible shift pairing: ${shiftPairing ?? 'yes'}`
                        : 'Selected lines cannot form legal doubles (need different start-time buckets, e.g. AM + PM).'}
                </p>
            </div>

            <p className="text-xs text-muted-foreground">
                Click highlighted overlap days to cycle: User A double → User B
                double → clear.
            </p>

            <div className="overflow-x-auto rounded-lg border border-sidebar-border/70">
                <table className="w-full min-w-[48rem] border-collapse text-[10px]">
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
                                                    cycleAssignment(day)
                                                }
                                            >
                                                {status === 'line_off'
                                                    ? '·'
                                                    : BUDDY_STATUS_LABELS[
                                                          status
                                                      ].charAt(0)}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
