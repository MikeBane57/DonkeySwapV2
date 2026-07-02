<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\BidScenarioLineNote;
use Illuminate\Support\Collection;

final class ScoredLineResponseFormatter
{
    public function __construct(
        private readonly LineRowFormatter $rowFormatter,
        private readonly ScenarioScoreService $scoreService,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $scores
     * @param  Collection<int, BidScenarioLineNote>|null  $notes
     * @return array{scored_rows: list<array<string, mixed>>, sort_explanation: array<string, mixed>}
     */
    public function format(BidScenario $scenario, array $scores, ?Collection $notes = null): array
    {
        $lineModels = BidLine::query()
            ->whereIn('id', collect($scores)->pluck('bid_line_id')->all())
            ->get()
            ->keyBy('id');

        $rank = 1;
        $rows = [];
        foreach ($scores as $row) {
            $id = (int) $row['bid_line_id'];
            $lm = $lineModels->get($id);
            $deskTier = (int) ($row['tier_ranks']['desk'] ?? PHP_INT_MAX);
            $rows[] = [
                'rank' => $rank++,
                'bid_line_id' => $id,
                'line_num' => $row['line_num'],
                'total' => $row['total'],
                'parts' => $row['parts'] ?? [],
                'line' => $lm ? $this->rowFormatter->format($lm) : null,
                'submitted_externally' => (bool) ($notes?->get($id)?->submitted_externally ?? false),
                'sort_debug' => [
                    'desk_bucket' => (string) ($row['breakdown']['group_bucket'] ?? ''),
                    'desk_tier' => $deskTier,
                    'desk_tier_label' => self::deskTierLabel($deskTier),
                    'sort_scores' => $row['sort_scores'] ?? [],
                    'tier_ranks' => $row['tier_ranks'] ?? [],
                    'start_time_tiebreak_key' => (string) ($row['start_time_tiebreak_key'] ?? 'other'),
                ],
            ];
        }

        return [
            'scored_rows' => $rows,
            'sort_explanation' => $this->scoreService->buildSortExplanation($scenario, $scores),
        ];
    }

    public static function deskTierLabel(int $tier): string
    {
        if ($tier <= 0 || $tier === PHP_INT_MAX) {
            return 'Unranked';
        }

        return 'G'.$tier;
    }
}
