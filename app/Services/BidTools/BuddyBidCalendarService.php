<?php

namespace App\Services\BidTools;

use App\Models\BidLineDay;
use App\Models\BuddyBidDayAssignment;
use App\Models\BuddyBidParticipant;
use App\Models\BuddyBidPlan;
use Carbon\Carbon;

final class BuddyBidCalendarService
{
    public const STATUS_LINE_OFF = 'line_off';

    public const STATUS_VACATION = 'vacation';

    public const STATUS_PULL = 'pull';

    public const STATUS_TRAINING = 'training';

    public const STATUS_SINGLE = 'single';

    public const STATUS_DOUBLE = 'double';

    public const STATUS_BUDDY_OFF = 'buddy_off';

    public const STATUS_OVERLAP_PENDING = 'overlap_pending';

    public function __construct(
        private readonly BuddyBidDoubleCompatibility $doubleCompatibility,
        private readonly StartTimeNormalizer $startTimes,
    ) {}

    /**
     * @return array{
     *   bid_year: int,
     *   lines_can_double: bool,
     *   shift_pairing: string|null,
     *   participants: list<array{
     *     id: int,
     *     slot: int,
     *     display_name: string,
     *     bid_line_id: int|null,
     *     line_num: string|null,
     *     desk_group: string|null,
     *     start_time: string|null,
     *     shift_bucket: string|null,
     *     profile: array,
     *   }>,
     *   months: list<array{
     *     key: string,
     *     label: string,
     *     days: list<array{
     *       date: string,
     *       day_of_month: int,
     *       is_compatible_overlap: bool,
     *       double_participant_id: int|null,
     *       participants: list<array{
     *         participant_id: int,
     *         status: string,
     *         line_works: bool,
     *         code: string|null,
     *       }>,
     *     }>,
     *   }>,
     *   summary: list<array{
     *     participant_id: int,
     *     display_name: string,
     *     doubles: int,
     *     singles: int,
     *     buddy_offs: int,
     *     vacation_on_work: int,
     *     pulls_on_work: int,
     *     training_on_work: int,
     *     line_offs: int,
     *     overlap_pending: int,
     *   }>,
     *   balance: array{
     *     doubles_delta: int,
     *     singles_adjusted_delta: int,
     *     unassigned_overlaps: int,
     *   },
     * }
     */
    public function build(BuddyBidPlan $plan): array
    {
        $plan->load([
            'import',
            'participants.line.days',
            'dayAssignments',
        ]);

        $participants = $plan->participants->values();
        $bidYear = $plan->import->bid_year;
        $range = BidYearRange::fromBidYear($bidYear);

        $linesCanDouble = false;
        $shiftPairing = null;
        if ($participants->count() === 2
            && $participants[0]->line
            && $participants[1]->line) {
            $bucketA = $this->doubleCompatibility->shiftBucketForLine($participants[0]->line);
            $bucketB = $this->doubleCompatibility->shiftBucketForLine($participants[1]->line);
            $shiftPairing = $this->doubleCompatibility->pairingType($bucketA, $bucketB);
            $linesCanDouble = $shiftPairing !== null;
        }

        $assignmentsByDate = $plan->dayAssignments->keyBy(
            fn (BuddyBidDayAssignment $a) => $a->assignment_date->format('Y-m-d'),
        );

        $dayMaps = $participants->mapWithKeys(function (BuddyBidParticipant $p) {
            if (! $p->line) {
                return [$p->id => collect()];
            }

            return [
                $p->id => $p->line->days->keyBy(
                    fn (BidLineDay $d) => $d->assignment_date->format('Y-m-d'),
                ),
            ];
        });

        $vacationSets = $participants->mapWithKeys(
            fn (BuddyBidParticipant $p) => [$p->id => array_flip($p->vacationDates())],
        );
        $pullSets = $participants->mapWithKeys(
            fn (BuddyBidParticipant $p) => [$p->id => array_flip($p->pullDates())],
        );

        $summaryCounters = [];
        foreach ($participants as $p) {
            $summaryCounters[$p->id] = [
                'participant_id' => $p->id,
                'display_name' => $p->display_name,
                'doubles' => 0,
                'singles' => 0,
                'buddy_offs' => 0,
                'vacation_on_work' => 0,
                'pulls_on_work' => 0,
                'training_on_work' => 0,
                'line_offs' => 0,
                'overlap_pending' => 0,
            ];
        }

        $months = [];
        $currentMonth = null;
        $monthDays = [];
        $unassignedOverlaps = 0;

        foreach ($range->eachDate() as $date) {
            $dateKey = $date->format('Y-m-d');
            $monthKey = $date->format('Y-m');

            if ($currentMonth !== $monthKey) {
                if ($currentMonth !== null) {
                    $months[] = $this->monthPayload($currentMonth, $monthDays);
                }
                $currentMonth = $monthKey;
                $monthDays = [];
            }

            $lineWorks = [];
            foreach ($participants as $p) {
                /** @var BidLineDay|null $day */
                $day = $dayMaps[$p->id][$dateKey] ?? null;
                $lineWorks[$p->id] = $this->isWorkDayForDoubles($day);
            }

            $bothWork = $participants->count() === 2
                && ($lineWorks[$participants[0]->id] ?? false)
                && ($lineWorks[$participants[1]->id] ?? false);

            $isCompatibleOverlap = $bothWork && $linesCanDouble;

            /** @var BuddyBidDayAssignment|null $assignment */
            $assignment = $assignmentsByDate[$dateKey] ?? null;
            $doubleParticipantId = $assignment?->double_participant_id;

            if ($isCompatibleOverlap && $doubleParticipantId === null) {
                $unassignedOverlaps++;
            }

            $participantCells = [];
            foreach ($participants as $p) {
                /** @var BidLineDay|null $day */
                $day = $dayMaps[$p->id][$dateKey] ?? null;
                $status = $this->resolveStatus(
                    $p,
                    $day,
                    $isCompatibleOverlap,
                    $doubleParticipantId,
                    isset($vacationSets[$p->id][$dateKey]),
                    isset($pullSets[$p->id][$dateKey]),
                );

                $this->incrementSummary($summaryCounters[$p->id], $status, $day);

                $participantCells[] = [
                    'participant_id' => $p->id,
                    'status' => $status,
                    'line_works' => $day !== null && ! $day->is_off,
                    'code' => $day?->normalized_code,
                ];
            }

            $monthDays[] = [
                'date' => $dateKey,
                'day_of_month' => (int) $date->format('j'),
                'is_compatible_overlap' => $isCompatibleOverlap,
                'double_participant_id' => $doubleParticipantId,
                'participants' => $participantCells,
            ];
        }

        if ($currentMonth !== null) {
            $months[] = $this->monthPayload($currentMonth, $monthDays);
        }

        $summary = array_values($summaryCounters);
        $balance = $this->computeBalance($summary, $unassignedOverlaps);

        return [
            'bid_year' => $bidYear,
            'lines_can_double' => $linesCanDouble,
            'shift_pairing' => $shiftPairing,
            'participants' => $participants->map(fn (BuddyBidParticipant $p) => [
                'id' => $p->id,
                'slot' => $p->slot,
                'display_name' => $p->display_name,
                'bid_line_id' => $p->bid_line_id,
                'line_num' => $p->line?->line_num,
                'desk_group' => $p->line?->desk_group,
                'start_time' => $p->line?->start_time,
                'shift_bucket' => $p->line
                    ? $this->doubleCompatibility->shiftBucketForLine($p->line)
                    : null,
                'profile' => $p->profile ?? $this->defaultProfile(),
            ])->values()->all(),
            'months' => $months,
            'summary' => $summary,
            'balance' => $balance,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function defaultProfile(): array
    {
        return [
            'vacation_dates' => [],
            'pull_dates' => [],
        ];
    }

    private function resolveStatus(
        BuddyBidParticipant $participant,
        ?BidLineDay $day,
        bool $isCompatibleOverlap,
        ?int $doubleParticipantId,
        bool $isVacation,
        bool $isPull,
    ): string {
        if ($day === null || $day->is_off) {
            return self::STATUS_LINE_OFF;
        }

        if ($isVacation) {
            return self::STATUS_VACATION;
        }

        if ($isPull) {
            return self::STATUS_PULL;
        }

        if ($this->isTrainingDay($day)) {
            return self::STATUS_TRAINING;
        }

        if ($isCompatibleOverlap) {
            if ($doubleParticipantId === $participant->id) {
                return self::STATUS_DOUBLE;
            }

            if ($doubleParticipantId !== null) {
                return self::STATUS_BUDDY_OFF;
            }

            return self::STATUS_OVERLAP_PENDING;
        }

        return self::STATUS_SINGLE;
    }

    private function isTrainingDay(?BidLineDay $day): bool
    {
        if ($day === null || $day->is_off) {
            return false;
        }

        $code = $day->normalized_code;

        return $code !== null && in_array(strtoupper($code), ['TAM', 'TPM'], true);
    }

    private function isWorkDayForDoubles(?BidLineDay $day): bool
    {
        return $day !== null && ! $day->is_off && ! $this->isTrainingDay($day);
    }

    /**
     * @param  array<string, int|string>  $counter
     */
    private function incrementSummary(array &$counter, string $status, ?BidLineDay $day): void
    {
        match ($status) {
            self::STATUS_DOUBLE => $counter['doubles']++,
            self::STATUS_SINGLE => $counter['singles']++,
            self::STATUS_BUDDY_OFF => $counter['buddy_offs']++,
            self::STATUS_VACATION => $day && ! $day->is_off ? $counter['vacation_on_work']++ : null,
            self::STATUS_PULL => $day && ! $day->is_off ? $counter['pulls_on_work']++ : null,
            self::STATUS_TRAINING => $day && ! $day->is_off ? $counter['training_on_work']++ : null,
            self::STATUS_LINE_OFF => $counter['line_offs']++,
            self::STATUS_OVERLAP_PENDING => $counter['overlap_pending']++,
            default => null,
        };
    }

    /**
     * @param  list<array<string, mixed>>  $summary
     * @return array{doubles_delta: int, singles_adjusted_delta: int, unassigned_overlaps: int}
     */
    private function computeBalance(array $summary, int $unassignedOverlaps): array
    {
        if (count($summary) !== 2) {
            return [
                'doubles_delta' => 0,
                'singles_adjusted_delta' => 0,
                'unassigned_overlaps' => $unassignedOverlaps,
            ];
        }

        [$a, $b] = $summary;

        $doublesDelta = abs((int) $a['doubles'] - (int) $b['doubles']);

        $aAdjusted = (int) $a['singles'] + (int) $a['vacation_on_work'] + (int) $a['pulls_on_work'] + (int) $a['training_on_work'];
        $bAdjusted = (int) $b['singles'] + (int) $b['vacation_on_work'] + (int) $b['pulls_on_work'] + (int) $b['training_on_work'];
        $singlesAdjustedDelta = $aAdjusted - $bAdjusted;

        return [
            'doubles_delta' => $doublesDelta,
            'singles_adjusted_delta' => $singlesAdjustedDelta,
            'unassigned_overlaps' => $unassignedOverlaps,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $days
     * @return array{key: string, label: string, days: list<array<string, mixed>>}
     */
    private function monthPayload(string $monthKey, array $days): array
    {
        $first = Carbon::createFromFormat('Y-m-d', $monthKey.'-01');

        return [
            'key' => $monthKey,
            'label' => $first?->format('F Y') ?? $monthKey,
            'days' => $days,
        ];
    }
}
