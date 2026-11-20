import type { BuddyBidCalendarView } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-assignment-state';
import {
    buildBuddyBidGoogleCalendarIcs,
    downloadBuddyBidGoogleCalendar,
    slugifyFilenamePart,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-google-calendar';
import { buildBuddyBidSmokeCalendar } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-smoke-calendar';

const TEST_PLAN_LABEL = 'GCal import test — Feb 2027 only';

function smokeCalendarForExport(): BuddyBidCalendarView {
    return buildBuddyBidSmokeCalendar() as BuddyBidCalendarView;
}

export function buildBuddyBidGcalSmokeTestIcs(
    participantId: number,
): string | null {
    const smoke = smokeCalendarForExport();
    const participant = smoke.participants.find((p) => p.id === participantId);
    if (!participant) {
        return null;
    }
    const partner = smoke.participants.find((p) => p.id !== participantId);

    return (
        buildBuddyBidGoogleCalendarIcs({
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
            months: smoke.months,
            planName: TEST_PLAN_LABEL,
            bidYear: smoke.bid_year,
        }) || null
    );
}

export function downloadBuddyBidGcalSmokeTest(participantId: number): void {
    const smoke = smokeCalendarForExport();
    const participant = smoke.participants.find((p) => p.id === participantId);
    if (!participant) {
        window.alert(
            'Test calendar is only defined for the Feb 2027 smoke buddies.',
        );
        return;
    }

    const ics = buildBuddyBidGcalSmokeTestIcs(participantId);
    if (!ics) {
        window.alert(
            'Could not build the test calendar file. Check the smoke fixture.',
        );
        return;
    }

    const slug = slugifyFilenamePart(
        participant.display_name || `buddy-${participantId}`,
    );
    downloadBuddyBidGoogleCalendar(
        ics,
        `buddy-bid-GCAL-TEST-feb2027-${slug}.ics`,
    );
}

/** Event count for UI hint (VEVENT lines). */
export function countBuddyBidGcalSmokeTestEvents(
    participantId: number,
): number {
    const ics = buildBuddyBidGcalSmokeTestIcs(participantId);
    if (!ics) {
        return 0;
    }

    return (ics.match(/BEGIN:VEVENT/g) ?? []).length;
}
