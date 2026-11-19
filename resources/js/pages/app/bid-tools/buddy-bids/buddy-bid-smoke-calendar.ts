import type { BuddyDayStatus } from '@/pages/app/bid-tools/buddy-bids/buddy-bid-status';
import {
    isReliefWorkCode,
    workStartFromDayCode,
} from '@/pages/app/bid-tools/buddy-bids/buddy-bid-work-shift';

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

export type BuddyBidSmokeCalendar = {
    bid_year: number;
    lines_can_double: boolean;
    shift_pairing: string;
    participants: {
        id: number;
        slot: number;
        display_name: string;
        bid_line_id: number;
        line_num: string;
        desk_group: string;
        start_time: string;
        shift_bucket: string | null;
        profile: { vacation_dates: string[]; pull_dates: string[] };
    }[];
    months: {
        key: string;
        label: string;
        days: CalendarDay[];
    }[];
    summary: {
        participant_id: number;
        display_name: string;
        doubles: number;
        singles: number;
        buddy_offs: number;
        vacation_on_work: number;
        pulls_on_work: number;
        training_on_work: number;
        line_offs: number;
        overlap_pending: number;
    }[];
    balance: {
        doubles_delta: number;
        singles_adjusted_delta: number;
        unassigned_overlaps: number;
    };
};

export type SmokeScenarioNote = {
    date: string;
    label: string;
    detail: string;
};

const AM_PARTICIPANT = {
    id: 1,
    slot: 1,
    display_name: 'Smoke AM (0600)',
    bid_line_id: -1,
    line_num: '901',
    desk_group: 'DG',
    start_time: '0600',
    shift_bucket: 'am',
    profile: { vacation_dates: ['2027-02-13'], pull_dates: [] },
};

const PM_PARTICIPANT = {
    id: 2,
    slot: 2,
    display_name: 'Smoke PM (1400)',
    bid_line_id: -2,
    line_num: '902',
    desk_group: 'AS',
    start_time: '1400',
    shift_bucket: 'pm',
    profile: { vacation_dates: [], pull_dates: ['2027-02-14'] },
};

type DaySpec = {
    codes: [string, string];
    statuses: [BuddyDayStatus, BuddyDayStatus];
    overlap: boolean;
    overlap_mode?: 'double' | 'singles' | null;
    double_participant_id?: number | null;
    line_works?: [boolean, boolean];
};

const FEB_2027_SCENARIOS: Record<string, DaySpec> = {
    '2027-02-01': {
        codes: ['DG1', 'AG1'],
        statuses: ['double', 'buddy_off'],
        overlap: true,
        overlap_mode: 'double',
        double_participant_id: 1,
    },
    '2027-02-02': {
        codes: ['DS1', 'AS1'],
        statuses: ['single', 'single'],
        overlap: true,
        overlap_mode: 'singles',
    },
    '2027-02-03': {
        codes: ['DS5', 'AS6'],
        statuses: ['single', 'single'],
        overlap: true,
        overlap_mode: 'singles',
    },
    '2027-02-04': {
        codes: ['DG1', 'MS2'],
        statuses: ['single', 'single'],
        overlap: false,
    },
    '2027-02-05': {
        codes: ['TAM', 'TAM'],
        statuses: ['training', 'training'],
        overlap: false,
    },
    '2027-02-06': {
        codes: ['TPM', 'TPM'],
        statuses: ['training', 'training'],
        overlap: false,
    },
    '2027-02-07': {
        codes: ['AS2', 'MG1'],
        statuses: ['buddy_off', 'double'],
        overlap: true,
        overlap_mode: 'double',
        double_participant_id: 2,
    },
    '2027-02-08': {
        codes: ['DG1', 'MG1'],
        statuses: ['double', 'buddy_off'],
        overlap: true,
        overlap_mode: 'double',
        double_participant_id: 1,
    },
    '2027-02-09': {
        codes: ['DS5', 'AS6'],
        statuses: ['overlap_pending', 'overlap_pending'],
        overlap: true,
        overlap_mode: null,
    },
    '2027-02-10': {
        codes: ['DG1', 'AG1'],
        statuses: ['single', 'single'],
        overlap: true,
        overlap_mode: 'singles',
    },
    '2027-02-11': {
        codes: ['RFS1', 'RFS2'],
        statuses: ['single', 'single'],
        overlap: false,
    },
    '2027-02-12': {
        codes: ['DXX', 'DXX'],
        statuses: ['line_off', 'line_off'],
        overlap: false,
        line_works: [false, false],
    },
    '2027-02-13': {
        codes: ['DG1', 'AG1'],
        statuses: ['vacation', 'single'],
        overlap: true,
        overlap_mode: 'singles',
    },
    '2027-02-14': {
        codes: ['DG1', 'AG1'],
        statuses: ['single', 'pull'],
        overlap: true,
        overlap_mode: 'singles',
    },
    '2027-02-15': {
        codes: ['DG1', 'AG1'],
        statuses: ['buddy_off', 'double'],
        overlap: true,
        overlap_mode: 'double',
        double_participant_id: 2,
    },
    '2027-02-16': {
        codes: ['DR2', 'AR2'],
        statuses: ['single', 'single'],
        overlap: false,
    },
};

export const BUDDY_BID_SMOKE_SCENARIO_NOTES: SmokeScenarioNote[] = [
    {
        date: '2027-02-01',
        label: 'AM + PM double',
        detail: '0600 DG vs 1400 AG; buddy off (gray o).',
    },
    {
        date: '2027-02-02',
        label: 'Overlap singles',
        detail: 'DS1 @ 0600 and AS1 @ 1400.',
    },
    {
        date: '2027-02-03',
        label: 'S5 / S6 singles',
        detail: '0700 (DS5) and 1500 (AS6) on overlap day.',
    },
    {
        date: '2027-02-04',
        label: 'AM + Mid singles',
        detail: '0600 DG1 and 2200 MS2 (non-overlap).',
    },
    {
        date: '2027-02-05',
        label: 'AM training',
        detail: 'TAM — DOM recurrent training window.',
    },
    {
        date: '2027-02-06',
        label: 'PM training',
        detail: 'TPM — DOM recurrent training window.',
    },
    {
        date: '2027-02-07',
        label: 'PM + Mid double',
        detail: '1400 AS2 with 2200 MG1; PM buddy doubles.',
    },
    {
        date: '2027-02-08',
        label: 'AM + Mid double',
        detail: '0600 DG1 with 2200 MG1; AM buddy doubles.',
    },
    {
        date: '2027-02-09',
        label: 'Unassigned overlap',
        detail: 'S5/S6 overlap pending (yellow).',
    },
    {
        date: '2027-02-10',
        label: 'Overlap singles',
        detail: 'Another 0600 / 1400 overlap singles day.',
    },
    {
        date: '2027-02-11',
        label: 'RFS relief',
        detail: 'Relief work — counts as work, no start time yet.',
    },
    {
        date: '2027-02-12',
        label: 'DXX off',
        detail: 'Non-work code.',
    },
    {
        date: '2027-02-13',
        label: 'Vacation on work',
        detail: 'AM buddy vacation on a work day.',
    },
    {
        date: '2027-02-14',
        label: 'Pull on work',
        detail: 'PM buddy pull on a work day.',
    },
    {
        date: '2027-02-15',
        label: 'PM doubles',
        detail: 'Second buddy doubled; AM shows buddy off.',
    },
    {
        date: '2027-02-16',
        label: 'DR / AR desks',
        detail: '0700 and 1500 without S5/S6 suffix.',
    },
];

function formatStartHint(
    code: string,
    lineStart: string,
    deskGroup: string,
): string {
    if (isReliefWorkCode(code)) {
        return `${code} (relief — no start yet)`;
    }
    const start = workStartFromDayCode(code, lineStart, deskGroup);
    if (start) {
        return `${code} @ ${start.slice(0, 2)}:${start.slice(2)}`;
    }

    return code;
}

export function buddyBidSmokeDayStartHints(): Record<string, string> {
    const hints: Record<string, string> = {};
    for (const [date, spec] of Object.entries(FEB_2027_SCENARIOS)) {
        const parts = spec.codes.map((code, index) => {
            const meta = index === 0 ? AM_PARTICIPANT : PM_PARTICIPANT;

            return formatStartHint(code, meta.start_time, meta.desk_group);
        });
        hints[date] = parts.join(' · ');
    }

    return hints;
}

export function buildBuddyBidSmokeCalendar(): BuddyBidSmokeCalendar {
    const days: CalendarDay[] = [];

    for (let day = 1; day <= 28; day += 1) {
        const date = `2027-02-${String(day).padStart(2, '0')}`;
        const spec = FEB_2027_SCENARIOS[date];

        if (!spec) {
            days.push({
                date,
                day_of_month: day,
                is_compatible_overlap: false,
                overlap_mode: null,
                double_participant_id: null,
                participants: [
                    {
                        participant_id: 1,
                        status: 'line_off',
                        line_works: false,
                        code: null,
                    },
                    {
                        participant_id: 2,
                        status: 'line_off',
                        line_works: false,
                        code: null,
                    },
                ],
            });
            continue;
        }

        const lineWorks = spec.line_works ?? [
            spec.codes[0] !== 'DXX',
            spec.codes[1] !== 'DXX',
        ];

        days.push({
            date,
            day_of_month: day,
            is_compatible_overlap: spec.overlap,
            overlap_mode: spec.overlap_mode ?? null,
            double_participant_id: spec.double_participant_id ?? null,
            participants: [
                {
                    participant_id: 1,
                    status: spec.statuses[0],
                    line_works: lineWorks[0],
                    code: spec.codes[0] === 'DXX' ? null : spec.codes[0],
                },
                {
                    participant_id: 2,
                    status: spec.statuses[1],
                    line_works: lineWorks[1],
                    code: spec.codes[1] === 'DXX' ? null : spec.codes[1],
                },
            ],
        });
    }

    return {
        bid_year: 2027,
        lines_can_double: true,
        shift_pairing: 'ok (0600/0700 + 1400/1500/2200)',
        participants: [AM_PARTICIPANT, PM_PARTICIPANT],
        months: [
            {
                key: '2027-02',
                label: 'February 2027 (smoke)',
                days,
            },
        ],
        summary: [
            {
                participant_id: 1,
                display_name: AM_PARTICIPANT.display_name,
                doubles: 2,
                singles: 6,
                buddy_offs: 2,
                vacation_on_work: 1,
                pulls_on_work: 0,
                training_on_work: 1,
                line_offs: 12,
                overlap_pending: 1,
            },
            {
                participant_id: 2,
                display_name: PM_PARTICIPANT.display_name,
                doubles: 2,
                singles: 6,
                buddy_offs: 2,
                vacation_on_work: 0,
                pulls_on_work: 1,
                training_on_work: 1,
                line_offs: 12,
                overlap_pending: 1,
            },
        ],
        balance: {
            doubles_delta: 0,
            singles_adjusted_delta: 0,
            unassigned_overlaps: 1,
        },
    };
}