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

        return $lines->map(function (BidLine $line) use ($notes) {
            $picker = $this->deskClassifier->linePickerFields($line);

            return [
                ...$picker,
                'submitted_externally' => (bool) ($notes[$line->id]->submitted_externally ?? false),
            ];
        })->all();
    }
}
