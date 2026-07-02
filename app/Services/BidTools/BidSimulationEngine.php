<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;

final class BidSimulationEngine
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly LineRowFormatter $rowFormatter,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function recommendForParticipant(BidSimulationParticipant $participant): array
    {
        $participant->loadMissing('scenario.import');
        $scenario = $participant->scenario;
        $minimumDepth = max(1, (int) $participant->seniority_rank);

        $lineIds = BidLine::query()
            ->where('bid_import_id', $scenario->bid_import_id)
            ->orderBy('line_num')
            ->pluck('id')
            ->all();

        $scored = $this->scoreService->scoreLines($scenario, $lineIds);
        $lineModels = BidLine::query()
            ->whereIn('id', $lineIds)
            ->get()
            ->keyBy('id');

        $rows = [];
        foreach ($scored as $index => $row) {
            $rank = $index + 1;
            $lineModel = $lineModels->get((int) $row['bid_line_id']);
            $formatted = $lineModel ? $this->rowFormatter->format($lineModel) : null;

            $rows[] = [
                'rank' => $rank,
                'bid_line_id' => (int) $row['bid_line_id'],
                'line_num' => $row['line_num'],
                'total' => $row['total'],
                'parts' => $row['parts'] ?? [],
                'minimum_required' => $rank <= $minimumDepth,
                'desk_group' => $formatted['desk_group'] ?? null,
                'start_time' => $formatted['start_time'] ?? null,
                'holidays_off' => $formatted['metrics']['holidays_off'] ?? null,
                'key_holidays' => $formatted['metrics']['key_holidays'] ?? [],
                'schedule_callouts' => $formatted['schedule_callouts'] ?? '—',
            ];
        }

        return $rows;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function run(BidSimulation $simulation): array
    {
        $simulation->load(['participants.scenario', 'import']);
        $participants = $simulation->participants->sortBy('seniority_rank')->values();
        $takenLineIds = [];
        $results = [];

        foreach ($participants as $participant) {
            $scenario = $participant->scenario;
            if ($scenario === null) {
                $results[] = $this->emptyResult($participant, 'No preference profile assigned');

                continue;
            }

            $availableLineIds = BidLine::query()
                ->where('bid_import_id', $simulation->bid_import_id)
                ->whereNotIn('id', $takenLineIds)
                ->pluck('id')
                ->all();

            if ($availableLineIds === []) {
                $results[] = $this->emptyResult($participant, 'No lines remaining');

                continue;
            }

            $allLineIds = BidLine::query()
                ->where('bid_import_id', $simulation->bid_import_id)
                ->pluck('id')
                ->all();

            $fullRanking = $this->scoreService->scoreLines($scenario, $allLineIds);
            $preferenceRank = null;
            $pick = null;

            foreach ($fullRanking as $index => $row) {
                if (! in_array((int) $row['bid_line_id'], $takenLineIds, true)) {
                    $pick = $row;
                    $preferenceRank = $index + 1;
                    break;
                }
            }

            if ($pick === null) {
                $results[] = $this->emptyResult($participant, 'No available line in ranking');

                continue;
            }

            $lineId = (int) $pick['bid_line_id'];
            $takenLineIds[] = $lineId;
            $line = BidLine::query()->find($lineId);
            $formatted = $line ? $this->rowFormatter->format($line) : null;

            $results[] = [
                'participant_id' => $participant->id,
                'display_name' => $participant->display_name,
                'seniority_rank' => $participant->seniority_rank,
                'bid_line_id' => $lineId,
                'line_num' => $pick['line_num'],
                'desk_group' => $formatted['desk_group'] ?? null,
                'start_time' => $formatted['start_time'] ?? null,
                'preference_rank' => $preferenceRank,
                'total' => $pick['total'],
                'message' => null,
            ];
        }

        return $results;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyResult(BidSimulationParticipant $participant, string $message): array
    {
        return [
            'participant_id' => $participant->id,
            'display_name' => $participant->display_name,
            'seniority_rank' => $participant->seniority_rank,
            'bid_line_id' => null,
            'line_num' => null,
            'desk_group' => null,
            'start_time' => null,
            'preference_rank' => null,
            'total' => null,
            'message' => $message,
        ];
    }
}
