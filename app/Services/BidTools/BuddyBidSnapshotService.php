<?php

namespace App\Services\BidTools;

use App\Models\BuddyBidDayAssignment;
use App\Models\BuddyBidPlan;
use App\Models\BuddyBidPlanSnapshot;
use Carbon\Carbon;

final class BuddyBidSnapshotService
{
    public function __construct(
        private readonly BuddyBidCalendarService $calendar,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function assignmentsFromPlan(BuddyBidPlan $plan): array
    {
        $plan->loadMissing('dayAssignments');

        $assignments = [];

        foreach ($plan->dayAssignments as $assignment) {
            $date = $assignment->assignment_date->format('Y-m-d');
            $normalized = $this->encodeSnapshotAssignment(
                $assignment->overlap_mode,
                $assignment->double_participant_id,
            );

            if ($normalized !== null) {
                $assignments[$date] = $normalized;
            }
        }

        return $assignments;
    }

    /**
     * @return array{
     *   assignments: array<string, mixed>,
     *   summary: list<array<string, mixed>>,
     *   balance: array<string, mixed>,
     *   participants: list<array<string, mixed>>,
     * }
     */
    public function captureCurrentState(BuddyBidPlan $plan): array
    {
        $plan->load(['import', 'participants.line', 'dayAssignments']);
        $calendar = $this->calendar->build($plan);

        $assignments = [];

        foreach ($calendar['months'] as $month) {
            foreach ($month['days'] as $day) {
                if (! $day['is_compatible_overlap']) {
                    continue;
                }

                $encoded = $this->encodeSnapshotAssignment(
                    $day['overlap_mode'] ?? null,
                    $day['double_participant_id'] ?? null,
                );

                if ($encoded !== null) {
                    $assignments[$day['date']] = $encoded;
                }
            }
        }

        return [
            'assignments' => $assignments,
            'summary' => $calendar['summary'],
            'balance' => $calendar['balance'],
            'participants' => collect($calendar['participants'])
                ->map(fn (array $participant) => [
                    'id' => $participant['id'],
                    'slot' => $participant['slot'],
                    'display_name' => $participant['display_name'],
                ])
                ->values()
                ->all(),
        ];
    }

    public function createSnapshot(BuddyBidPlan $plan, string $name): BuddyBidPlanSnapshot
    {
        $state = $this->captureCurrentState($plan);

        return BuddyBidPlanSnapshot::create([
            'buddy_bid_plan_id' => $plan->id,
            'name' => $name,
            'assignments' => $state['assignments'],
            'summary' => $state['summary'],
            'balance' => $state['balance'],
            'participants' => $state['participants'],
        ]);
    }

    public function restoreSnapshot(BuddyBidPlan $plan, BuddyBidPlanSnapshot $snapshot): void
    {
        if ($snapshot->buddy_bid_plan_id !== $plan->id) {
            abort(404);
        }

        $this->replaceAssignments($plan, $snapshot->assignments ?? []);
    }

    public function resetAssignments(BuddyBidPlan $plan): void
    {
        BuddyBidDayAssignment::query()
            ->where('buddy_bid_plan_id', $plan->id)
            ->delete();
    }

    /**
     * @param  array<string, mixed>  $assignments
     */
    public function replaceAssignments(BuddyBidPlan $plan, array $assignments): void
    {
        $participantIds = $plan->participants()->pluck('id')->all();

        BuddyBidDayAssignment::query()
            ->where('buddy_bid_plan_id', $plan->id)
            ->delete();

        foreach ($assignments as $date => $value) {
            [$overlapMode, $participantId] = $this->decodeSnapshotAssignment($value);

            if ($overlapMode === BuddyBidDayAssignment::OVERLAP_MODE_SINGLES) {
                BuddyBidDayAssignment::create([
                    'buddy_bid_plan_id' => $plan->id,
                    'assignment_date' => Carbon::parse($date)->format('Y-m-d'),
                    'overlap_mode' => BuddyBidDayAssignment::OVERLAP_MODE_SINGLES,
                    'double_participant_id' => null,
                ]);

                continue;
            }

            if (
                $overlapMode !== BuddyBidDayAssignment::OVERLAP_MODE_DOUBLE
                || $participantId === null
                || ! in_array($participantId, $participantIds, true)
            ) {
                continue;
            }

            BuddyBidDayAssignment::create([
                'buddy_bid_plan_id' => $plan->id,
                'assignment_date' => Carbon::parse($date)->format('Y-m-d'),
                'overlap_mode' => BuddyBidDayAssignment::OVERLAP_MODE_DOUBLE,
                'double_participant_id' => $participantId,
            ]);
        }
    }

    /**
     * @param  list<array{
     *   key: string,
     *   id: int|null,
     *   name: string,
     *   created_at: string|null,
     *   assignments: array<string, mixed>,
     *   summary: list<array<string, mixed>>,
     *   balance: array<string, mixed>,
     *   participants: list<array<string, mixed>>,
     * }>  $versions
     * @return list<array{
     *   dates: list<string>,
     *   version_a: string,
     *   version_b: string,
     *   count: int,
     * }>
     */
    public function pairwiseDiffs(array $versions): array
    {
        $pairs = [];

        for ($left = 0; $left < count($versions); $left++) {
            for ($right = $left + 1; $right < count($versions); $right++) {
                $a = $versions[$left];
                $b = $versions[$right];
                $diffDates = [];

                $allDates = array_unique(array_merge(
                    array_keys($a['assignments']),
                    array_keys($b['assignments']),
                ));

                foreach ($allDates as $date) {
                    $aValue = $this->normalizeSnapshotValueForCompare(
                        $a['assignments'][$date] ?? null,
                    );
                    $bValue = $this->normalizeSnapshotValueForCompare(
                        $b['assignments'][$date] ?? null,
                    );

                    if ($aValue !== $bValue) {
                        $diffDates[] = $date;
                    }
                }

                $pairs[] = [
                    'version_a' => $a['key'],
                    'version_b' => $b['key'],
                    'count' => count($diffDates),
                    'dates' => $diffDates,
                ];
            }
        }

        return $pairs;
    }

    private function encodeSnapshotAssignment(
        ?string $overlapMode,
        ?int $doubleParticipantId,
    ): mixed {
        if ($overlapMode === BuddyBidDayAssignment::OVERLAP_MODE_SINGLES) {
            return BuddyBidDayAssignment::OVERLAP_MODE_SINGLES;
        }

        if ($doubleParticipantId !== null) {
            return $doubleParticipantId;
        }

        return null;
    }

    /**
     * @return array{0: ?string, 1: ?int}
     */
    private function decodeSnapshotAssignment(mixed $value): array
    {
        if ($value === BuddyBidDayAssignment::OVERLAP_MODE_SINGLES) {
            return [BuddyBidDayAssignment::OVERLAP_MODE_SINGLES, null];
        }

        if (is_int($value) || (is_string($value) && ctype_digit($value))) {
            return [BuddyBidDayAssignment::OVERLAP_MODE_DOUBLE, (int) $value];
        }

        if (is_array($value)) {
            $mode = $value['overlap_mode'] ?? null;
            $id = $value['double_participant_id'] ?? null;

            if ($mode === BuddyBidDayAssignment::OVERLAP_MODE_SINGLES) {
                return [BuddyBidDayAssignment::OVERLAP_MODE_SINGLES, null];
            }

            if ($mode === BuddyBidDayAssignment::OVERLAP_MODE_DOUBLE && $id !== null) {
                return [BuddyBidDayAssignment::OVERLAP_MODE_DOUBLE, (int) $id];
            }
        }

        return [null, null];
    }

    private function normalizeSnapshotValueForCompare(mixed $value): string
    {
        [$mode, $id] = $this->decodeSnapshotAssignment($value);

        if ($mode === BuddyBidDayAssignment::OVERLAP_MODE_SINGLES) {
            return 'singles';
        }

        if ($mode === BuddyBidDayAssignment::OVERLAP_MODE_DOUBLE && $id !== null) {
            return 'double:'.$id;
        }

        return 'pending';
    }
}
