<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenarioLineNote;

final class BidLinePickerService
{
    public function __construct(
        private readonly CondensedDeskClassifier $deskClassifier,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function rowsForImport(int $importId, ?int $scenarioId = null): array
    {
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

        $rows = $lines->map(function (BidLine $line) use ($notes) {
            $picker = $this->deskClassifier->linePickerFields($line);

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
        $order = array_flip(['am', 'pm', 'mid', 'relief', 'other']);

        usort($rows, function (array $a, array $b) use ($order): int {
            $aShift = is_string($a['desk_shift'] ?? null) ? $a['desk_shift'] : 'other';
            $bShift = is_string($b['desk_shift'] ?? null) ? $b['desk_shift'] : 'other';
            $aRank = $order[$aShift] ?? 99;
            $bRank = $order[$bShift] ?? 99;
            if ($aRank !== $bRank) {
                return $aRank <=> $bRank;
            }

            return strcmp((string) ($a['line_num'] ?? ''), (string) ($b['line_num'] ?? ''));
        });

        return $rows;
    }
}
