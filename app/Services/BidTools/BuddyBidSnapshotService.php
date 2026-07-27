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
     * @return array<string, int>
     */
    public function assignmentsFromPlan(BuddyBidPlan $plan): array
    {
        $plan->loadMissing('dayAssignments');

        $assignments = [];

        foreach ($plan->dayAssignments as $assignment) {
            if ($assignment->double_participant_id === null) {
                continue;
            }

            $assignments[$assignment->assignment_date->format('Y-m-d')] = $assignment->double_participant_id;
        }

        return $assignments;
    }

    /**
     * @return array{
     *   assignments: array<string, int>,
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
                if ($day['is_compatible_overlap'] && $day['double_participant_id'] !== null) {
                    $assignments[$day['date']] = $day['double_participant_id'];
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
     * @param  array<string, int|null>  $assignments
     */
    public function replaceAssignments(BuddyBidPlan $plan, array $assignments): void
    {
        $participantIds = $plan->participants()->pluck('id')->all();

        BuddyBidDayAssignment::query()
            ->where('buddy_bid_plan_id', $plan->id)
            ->delete();

        foreach ($assignments as $date => $participantId) {
            if ($participantId === null || ! in_array((int) $participantId, $participantIds, true)) {
                continue;
            }

            BuddyBidDayAssignment::create([
                'buddy_bid_plan_id' => $plan->id,
                'assignment_date' => Carbon::parse($date)->format('Y-m-d'),
                'double_participant_id' => (int) $participantId,
            ]);
        }
    }

    /**
     * @param  list<array{
     *   key: string,
     *   id: int|null,
     *   name: string,
     *   created_at: string|null,
     *   assignments: array<string, int>,
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
                    $aId = $a['assignments'][$date] ?? null;
                    $bId = $b['assignments'][$date] ?? null;

                    if ($aId !== $bId) {
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
}
