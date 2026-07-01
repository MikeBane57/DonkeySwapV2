<?php

namespace App\Services\BidTools;

use App\Models\BidImport;
use App\Models\BidScenario;

final class BidScenarioProfileBuilder
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly CondensedBidderProfileMapper $condensedMapper,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function defaultsForImport(BidImport $import): array
    {
        $condensed = $this->condensedMapper->condensedDefaults();

        return [
            'vacation_bank' => 15,
            'weights' => ScenarioScoreService::defaultWeights(),
            'holiday_rank' => $condensed['holiday_rank'],
            'desk_rank' => $condensed['desk_rank'],
            'personal_dates' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toEditorPayload(BidScenario $scenario): array
    {
        $scenario->loadMissing(['import', 'vacationRanges']);

        $weights = array_merge(
            ScenarioScoreService::defaultWeights(),
            $scenario->weights ?? [],
        );
        $weights['criteria_order'] = ScenarioScoreService::normalizeCriteriaOrder($weights['criteria_order'] ?? null);
        $weights['start_time_tiebreak_order'] = ScenarioScoreService::normalizeStartTimeTiebreakOrder(
            $weights['start_time_tiebreak_order'] ?? $weights['shift_order'] ?? null,
        );
        $weights['sort_mode'] = ScenarioScoreService::normalizeSortMode($weights['sort_mode'] ?? null);
        unset($weights['shift_order'], $weights['strict_shift_order'], $weights['strict_shift_rank'], $weights['start_time']);

        $condensed = $this->condensedMapper->toCondensedPayload($scenario);

        $legacyRanges = $scenario->vacationRanges->map(fn ($r) => [
            'title' => $r->title ?? '',
            'starts_on' => $r->starts_on->format('Y-m-d'),
            'ends_on' => $r->ends_on->format('Y-m-d'),
        ])->all();

        return [
            'vacation_bank' => $scenario->vacation_bank,
            'weights' => $weights,
            'holiday_rank' => $condensed['holiday_rank'],
            'desk_rank' => $condensed['desk_rank'],
            'personal_dates' => $this->scoreService->personalDatesForEditor(
                $scenario->personal_dates ?? [],
                $legacyRanges,
            ),
            'desk_bucket_mappings' => $scenario->desk_bucket_mappings ?? [],
        ];
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    public function createForSimulation(
        int $userId,
        BidImport $import,
        string $scenarioName,
        array $profile,
    ): BidScenario {
        $merged = $this->mergeProfile($import, $profile);

        return BidScenario::create([
            'user_id' => $userId,
            'bid_import_id' => $import->id,
            'name' => $scenarioName,
            'vacation_bank' => (int) $merged['vacation_bank'],
            'weights' => $merged['weights'],
            'holiday_rank' => $merged['holiday_rank'],
            'desk_rank' => $merged['desk_rank'],
            'start_time_rank' => [],
            'personal_dates' => $merged['personal_dates'],
            'code_overrides' => [],
            'desk_bucket_mappings' => [],
        ]);
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    public function applyToScenario(BidScenario $scenario, array $profile): void
    {
        $scenario->loadMissing('import');
        $merged = $this->mergeProfile($scenario->import, $profile);

        $scenario->fill([
            'vacation_bank' => (int) $merged['vacation_bank'],
            'weights' => $merged['weights'],
            'holiday_rank' => $merged['holiday_rank'],
            'desk_rank' => $merged['desk_rank'],
            'personal_dates' => $merged['personal_dates'],
            'desk_bucket_mappings' => $merged['desk_bucket_mappings'],
        ]);
        $scenario->save();
    }

    /**
     * @param  array<string, mixed>  $profile
     * @return array<string, mixed>
     */
    public function prepareDraftForScoring(BidImport $import, array $profile): array
    {
        return $this->mergeProfile($import, $profile);
    }

    /**
     * @param  array<string, mixed>  $profile
     * @return array<string, mixed>
     */
    private function mergeProfile(BidImport $import, array $profile): array
    {
        $defaults = $this->defaultsForImport($import);
        $expanded = $this->condensedMapper->expandProfile($import, $profile);

        $weights = array_merge(
            $defaults['weights'],
            is_array($profile['weights'] ?? null) ? $profile['weights'] : [],
        );

        $weights['criteria_order'] = ScenarioScoreService::normalizeCriteriaOrder(
            $weights['criteria_order'] ?? $defaults['weights']['criteria_order'],
        );
        $weights['sort_mode'] = ScenarioScoreService::normalizeSortMode($weights['sort_mode'] ?? null);
        $weights['start_time_tiebreak_order'] = ScenarioScoreService::normalizeStartTimeTiebreakOrder(
            $weights['start_time_tiebreak_order'] ?? $weights['shift_order'] ?? null,
        );
        unset($weights['shift_order'], $weights['strict_shift_order'], $weights['strict_shift_rank'], $weights['start_time']);

        return [
            'vacation_bank' => (int) ($profile['vacation_bank'] ?? $defaults['vacation_bank']),
            'weights' => $weights,
            'holiday_rank' => $expanded['holiday_rank'],
            'desk_rank' => $expanded['desk_rank'],
            'personal_dates' => is_array($profile['personal_dates'] ?? null)
                ? $profile['personal_dates']
                : $defaults['personal_dates'],
            'desk_bucket_mappings' => is_array($profile['desk_bucket_mappings'] ?? null)
                ? $profile['desk_bucket_mappings']
                : [],
        ];
    }
}
