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
    public function recommendForParticipant(
        BidSimulationParticipant $participant,
        ?BidSimulation $simulation = null,
    ): array {
        $participant->loadMissing('scenario.import');
        $scenario = $participant->scenario;
        $minimumDepth = max(1, (int) $participant->seniority_rank);

        $mappingOverrides = $this->mappingOverridesForSimulation($simulation);

        $lineIds = BidLine::query()
            ->where('bid_import_id', $scenario->bid_import_id)
            ->orderBy('line_num')
            ->pluck('id')
            ->all();

        $preloadedLines = BidLine::query()
            ->where('bid_import_id', $scenario->bid_import_id)
            ->whereIn('id', $lineIds)
            ->with(['days' => fn ($query) => $query->orderBy('assignment_date')])
            ->get()
            ->keyBy('id');

        foreach ($preloadedLines as $line) {
            $line->setRelation('import', $scenario->import);
        }

        $scored = $this->scoreService->scoreLines(
            $scenario,
            $lineIds,
            withMetrics: true,
            deskBucketMappingsOverride: $mappingOverrides['desk_bucket_mappings'],
            lineDeskBucketsOverride: $mappingOverrides['line_desk_buckets'],
            preloadedLines: $preloadedLines,
        );

        $rows = [];
        foreach ($scored as $index => $row) {
            $rank = $index + 1;
            $lineModel = $preloadedLines->get((int) $row['bid_line_id']);
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
        $simulation->load(['participants.scenario.import', 'import']);
        $participants = $simulation->participants->sortBy('seniority_rank')->values();
        $mappingOverrides = $this->mappingOverridesForSimulation($simulation);

        $allLineIds = BidLine::query()
            ->where('bid_import_id', $simulation->bid_import_id)
            ->orderBy('line_num')
            ->pluck('id')
            ->all();

        $preloadedLines = BidLine::query()
            ->where('bid_import_id', $simulation->bid_import_id)
            ->whereIn('id', $allLineIds)
            ->with(['days' => fn ($query) => $query->orderBy('assignment_date')])
            ->get()
            ->keyBy('id');

        $import = $simulation->import;
        foreach ($preloadedLines as $line) {
            $line->setRelation('import', $import);
        }

        /** @var array<int, list<array<string, mixed>>> $rankingsByScenarioId */
        $rankingsByScenarioId = [];
        $takenLineIds = [];
        $results = [];

        foreach ($participants as $participant) {
            if ($participant->skips_bid) {
                $results[] = [
                    ...$this->emptyResult($participant, 'Passed / no bid'),
                    'skipped' => true,
                ];

                continue;
            }

            $scenario = $participant->scenario;
            if ($scenario === null) {
                $results[] = $this->emptyResult($participant, 'No preference profile assigned');

                continue;
            }

            if ($allLineIds === []) {
                $results[] = $this->emptyResult($participant, 'No lines remaining');

                continue;
            }

            $scenarioId = (int) $scenario->id;
            if (! isset($rankingsByScenarioId[$scenarioId])) {
                $rankingsByScenarioId[$scenarioId] = $this->scoreService->scoreLines(
                    $scenario,
                    $allLineIds,
                    withMetrics: false,
                    deskBucketMappingsOverride: $mappingOverrides['desk_bucket_mappings'],
                    lineDeskBucketsOverride: $mappingOverrides['line_desk_buckets'],
                    preloadedLines: $preloadedLines,
                );
            }

            $fullRanking = $rankingsByScenarioId[$scenarioId];
            $preferenceRank = null;
            $pick = null;

            foreach ($fullRanking as $index => $row) {
                $lineId = (int) $row['bid_line_id'];
                if (! isset($takenLineIds[$lineId])) {
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
            $takenLineIds[$lineId] = true;
            $line = $preloadedLines->get($lineId);

            $results[] = [
                'participant_id' => $participant->id,
                'display_name' => $participant->display_name,
                'seniority_rank' => $participant->seniority_rank,
                'bid_line_id' => $lineId,
                'line_num' => $pick['line_num'],
                'desk_group' => $line?->desk_group,
                'start_time' => $line?->start_time,
                'preference_rank' => $preferenceRank,
                'total' => $pick['total'],
                'message' => null,
            ];
        }

        return $results;
    }

    /**
     * @return array{desk_bucket_mappings: array<int, mixed>, line_desk_buckets: array<int, mixed>}
     */
    private function mappingOverridesForSimulation(?BidSimulation $simulation): array
    {
        if ($simulation === null) {
            return [
                'desk_bucket_mappings' => null,
                'line_desk_buckets' => null,
            ];
        }

        return [
            'desk_bucket_mappings' => $simulation->desk_bucket_mappings ?? [],
            'line_desk_buckets' => $simulation->line_desk_buckets ?? [],
        ];
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
