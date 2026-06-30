<?php

namespace App\Services\BidTools;

use App\Models\BidImport;
use App\Models\BidScenario;
use App\Models\BidScenarioVacationRange;

final class BidScenarioProfileBuilder
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly BidLinePreferenceCatalog $preferenceCatalog,
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
            'start_time_rank' => $condensed['start_time_rank'],
            'personal_dates' => [],
            'vacation_ranges' => [],
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
        $weights['sort_mode'] = ScenarioScoreService::normalizeSortMode($weights['sort_mode'] ?? null);
        $weights['strict_shift_order'] = ScenarioScoreService::normalizeStrictShiftOrder($weights['strict_shift_order'] ?? null);

        $condensed = $this->condensedMapper->toCondensedPayload($scenario);

        return [
            'vacation_bank' => $scenario->vacation_bank,
            'weights' => $weights,
            'holiday_rank' => $condensed['holiday_rank'],
            'desk_rank' => $condensed['desk_rank'],
            'start_time_rank' => $condensed['start_time_rank'],
            'personal_dates' => $this->scoreService->personalDatesForEditor($scenario->personal_dates ?? []),
            'vacation_ranges' => $scenario->vacationRanges->map(fn ($r) => [
                'title' => $r->title ?? '',
                'starts_on' => $r->starts_on->format('Y-m-d'),
                'ends_on' => $r->ends_on->format('Y-m-d'),
            ])->all(),
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

        $scenario = BidScenario::create([
            'user_id' => $userId,
            'bid_import_id' => $import->id,
            'name' => $scenarioName,
            'vacation_bank' => (int) $merged['vacation_bank'],
            'weights' => $merged['weights'],
            'holiday_rank' => $merged['holiday_rank'],
            'desk_rank' => $merged['desk_rank'],
            'start_time_rank' => $merged['start_time_rank'],
            'personal_dates' => $merged['personal_dates'],
            'code_overrides' => [],
        ]);

        $this->syncVacationRanges($scenario, $merged['vacation_ranges']);

        return $scenario;
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
            'start_time_rank' => $merged['start_time_rank'],
            'personal_dates' => $merged['personal_dates'],
        ]);
        $scenario->save();

        $this->syncVacationRanges($scenario, $merged['vacation_ranges']);
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

        if (! is_array($weights['criteria_order'] ?? null) || count($weights['criteria_order']) !== 4) {
            $weights['criteria_order'] = $defaults['weights']['criteria_order'];
        }
        $weights['criteria_order'] = ScenarioScoreService::normalizeCriteriaOrder($weights['criteria_order']);
        $weights['sort_mode'] = ScenarioScoreService::normalizeSortMode($weights['sort_mode'] ?? null);
        $weights['strict_shift_order'] = ScenarioScoreService::normalizeStrictShiftOrder($weights['strict_shift_order'] ?? null);

        return [
            'vacation_bank' => (int) ($profile['vacation_bank'] ?? $defaults['vacation_bank']),
            'weights' => $weights,
            'holiday_rank' => $expanded['holiday_rank'],
            'desk_rank' => $expanded['desk_rank'],
            'start_time_rank' => $expanded['start_time_rank'],
            'personal_dates' => is_array($profile['personal_dates'] ?? null)
                ? $profile['personal_dates']
                : $defaults['personal_dates'],
            'vacation_ranges' => is_array($profile['vacation_ranges'] ?? null)
                ? $profile['vacation_ranges']
                : $defaults['vacation_ranges'],
        ];
    }

    /**
     * @param  list<array{title?: string, starts_on: string, ends_on: string}>  $ranges
     */
    private function syncVacationRanges(BidScenario $scenario, array $ranges): void
    {
        $scenario->vacationRanges()->delete();

        foreach ($ranges as $range) {
            if (empty($range['starts_on']) || empty($range['ends_on'])) {
                continue;
            }

            BidScenarioVacationRange::create([
                'bid_scenario_id' => $scenario->id,
                'title' => $range['title'] ?? null,
                'starts_on' => $range['starts_on'],
                'ends_on' => $range['ends_on'],
            ]);
        }
    }
}
