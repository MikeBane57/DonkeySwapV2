<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\BidScenarioLineNote;

final class BidLinePickerService
{
    public function __construct(
        private readonly CondensedDeskClassifier $deskClassifier,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function rowsForImport(
        int $importId,
        ?int $scenarioId = null,
        ?array $deskBucketMappings = null,
        ?array $lineDeskBuckets = null,
    ): array {
        $mappings = $deskBucketMappings ?? [];
        $lineBuckets = $lineDeskBuckets ?? [];
        if ($scenarioId !== null && $deskBucketMappings === null && $lineDeskBuckets === null) {
            $scenario = BidScenario::query()->find($scenarioId);
            $mappings = $scenario?->desk_bucket_mappings ?? [];
            $lineBuckets = $scenario?->line_desk_buckets ?? [];
        }

        $lines = BidLine::query()
            ->where('bid_import_id', $importId)
            ->orderBy('line_num')
            ->get();

        $notes = collect();
        if ($scenarioId !== null) {
            $notes = BidScenarioLineNote::query()
                ->where('bid_scenario_id', $scenarioId)
                ->get()
                ->keyBy('bid_line_id');
        }

        $rows = $lines->map(function (BidLine $line) use ($notes, $mappings, $lineBuckets) {
            $picker = $this->deskClassifier->linePickerFields($line, $mappings, $lineBuckets);

            return [
                ...$picker,
                'submitted_externally' => (bool) ($notes[$line->id]->submitted_externally ?? false),
            ];
        })->all();

        return $this->sortPickerRows($rows);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function sortPickerRows(array $rows): array
    {
        $order = array_flip(CondensedDeskClassifier::BUCKETS);

        usort($rows, function (array $a, array $b) use ($order): int {
            $aBucket = is_string($a['desk_bucket'] ?? null) ? $a['desk_bucket'] : 'unknown';
            $bBucket = is_string($b['desk_bucket'] ?? null) ? $b['desk_bucket'] : 'unknown';
            $aRank = $order[$aBucket] ?? 99;
            $bRank = $order[$bBucket] ?? 99;
            if ($aRank !== $bRank) {
                return $aRank <=> $bRank;
            }

            return strcmp((string) ($a['line_num'] ?? ''), (string) ($b['line_num'] ?? ''));
        });

        return $rows;
    }
}
