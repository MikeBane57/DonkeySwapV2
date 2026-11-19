import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CalendarRange } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    applyLocalAssignments,
    assignmentsFromCalendar,
    type BuddyBidCalendarView,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import { BuddyBidCalendar } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-calendar';
import { BuddyBidSummaryPanel } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-summary-panel';
import type { OverlapDayAssignment } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-overlap-assignment';
import {
    buildBuddyBidGoogleCalendarIcs,
    downloadBuddyBidGoogleCalendar,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-google-calendar';
import {
    BUDDY_BID_SMOKE_SCENARIO_NOTES,
    buddyBidSmokeDayStartHints,
    buildBuddyBidSmokeCalendar,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-smoke-calendar';
import { BidToolsCollapsibleSection } from '@/pages/app/bid-tools/bid-tools-collapsible-section';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Bid tools', href: '/app/bid-tools' },
    { title: 'Buddy bids', href: '/app/bid-tools/buddy-bids' },
    { title: 'Shift display smoke', href: '#' },
];

export default function BuddyBidSmokePreview() {
    const baseSmoke = useMemo(
        () => buildBuddyBidSmokeCalendar() as BuddyBidCalendarView,
        [],
    );
    const startHints = useMemo(() => buddyBidSmokeDayStartHints(), []);

    const [assignments, setAssignments] = useState(() =>
        assignmentsFromCalendar(baseSmoke),
    );

    const displayCalendar = useMemo(
        () => applyLocalAssignments(baseSmoke, assignments),
        [baseSmoke, assignments],
    );

    const assignOverlap = (
        date: string,
        assignment: OverlapDayAssignment,
    ) => {
        setAssignments((current) => ({
            ...current,
            [date]: assignment,
        }));
    };

    const downloadSmokeCalendar = (participantId: number) => {
        const participant = displayCalendar.participants.find(
            (p) => p.id === participantId,
        );
        if (!participant) {
            return;
        }
        const partner = displayCalendar.participants.find(
            (p) => p.id !== participantId,
        );
        const ics = buildBuddyBidGoogleCalendarIcs({
            participant: {
                id: participant.id,
                display_name: participant.display_name,
                desk_group: participant.desk_group,
                start_time: participant.start_time,
            },
            partner: partner
                ? {
                      id: partner.id,
                      display_name: partner.display_name,
                      desk_group: partner.desk_group,
                      start_time: partner.start_time,
                  }
                : null,
            months: displayCalendar.months,
            planName: 'Buddy bid smoke — Feb 2027',
            bidYear: displayCalendar.bid_year,
        });
        if (!ics) {
            window.alert('Nothing to export for this buddy in the smoke month.');
            return;
        }
        downloadBuddyBidGoogleCalendar(
            ics,
            `buddy-bid-smoke-${participantId}-2027-02.ics`,
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Buddy bid shift smoke — Feb 2027" />
            <div className="mx-auto max-w-6xl space-y-6 p-4 pb-12">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Shift display smoke test
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            February 2027 fixture — doubles, singles, training,
                            relief (RFS), buddy off, and Google Calendar export.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/app/bid-tools/buddy-bids">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to plans
                        </Link>
                    </Button>
                </div>

                <BidToolsCollapsibleSection
                    title="Scenario guide"
                    summary="16 labeled days"
                    defaultOpen
                >
                    <ul className="space-y-2 text-xs text-muted-foreground">
                        {BUDDY_BID_SMOKE_SCENARIO_NOTES.map((note) => (
                            <li key={note.date}>
                                <span className="font-mono text-foreground">
                                    {note.date.slice(8)}
                                </span>
                                <span className="mx-2 font-medium text-foreground">
                                    {note.label}
                                </span>
                                {note.detail}
                                {startHints[note.date] ? (
                                    <span className="mt-0.5 block font-mono text-[10px]">
                                        {startHints[note.date]}
                                    </span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </BidToolsCollapsibleSection>

                <div className="flex flex-wrap gap-2">
                    {displayCalendar.participants.map((p) => (
                        <Button
                            key={p.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => downloadSmokeCalendar(p.id)}
                        >
                            <CalendarRange className="mr-2 h-4 w-4" />
                            Google Cal ({p.display_name})
                        </Button>
                    ))}
                </div>

                <BuddyBidSummaryPanel
                    summary={displayCalendar.summary}
                    balance={displayCalendar.balance}
                />

                <BuddyBidCalendar
                    months={displayCalendar.months}
                    participants={displayCalendar.participants}
                    linesCanDouble={displayCalendar.lines_can_double}
                    shiftPairing={displayCalendar.shift_pairing}
                    assignmentByDate={assignments}
                    onAssignOverlap={assignOverlap}
                />
            </div>
        </AppLayout>
    );
}