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
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function defaultsForImport(BidImport $import): array
    {
        $bidYear = (int) $import->bid_year;
        $deskKeys = $this->preferenceCatalog->deskKeysForImport($import->id);
        $startKeys = $this->preferenceCatalog->startTimeKeysForImport($import->id);

        return [
            'vacation_bank' => 15,
            'weights' => [
                'holiday' => 1.0,
                'personal' => 1.0,
                'start_time' => 1.0,
                'desk' => 1.0,
                'vacation_penalty' => 1.0,
                'criteria_order' => ['holiday', 'personal', 'start_time', 'desk'],
            ],
            'holiday_rank' => $this->scoreService->defaultHolidayEntries($bidYear),
            'desk_rank' => $deskKeys === []
                ? $this->scoreService->defaultDeskEntries()
                : $this->scoreService->deskEntriesForEditor([], $deskKeys),
            'start_time_rank' => $startKeys === []
                ? $this->scoreService->defaultStartTimeEntries()
                : $this->scoreService->startTimeEntriesForEditor([], $startKeys),
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
        $bidYear = (int) $scenario->import->bid_year;
        $deskKeys = $this->preferenceCatalog->deskKeysForImport($scenario->bid_import_id);
        $startKeys = $this->preferenceCatalog->startTimeKeysForImport($scenario->bid_import_id);

        $weights = array_merge([
            'holiday' => 1.0,
            'personal' => 1.0,
            'start_time' => 1.0,
            'desk' => 1.0,
            'vacation_penalty' => 1.0,
            'criteria_order' => ['holiday', 'personal', 'start_time', 'desk'],
        ], $scenario->weights ?? []);

        return [
            'vacation_bank' => $scenario->vacation_bank,
            'weights' => $weights,
            'holiday_rank' => $this->scoreService->holidayEntriesForEditor($scenario->holiday_rank, $bidYear),
            'desk_rank' => $this->scoreService->deskEntriesForEditor($scenario->desk_rank, $deskKeys),
            'start_time_rank' => $this->scoreService->startTimeEntriesForEditor($scenario->start_time_rank, $startKeys),
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
        $defaults = $this->defaultsForImport($import);
        $merged = $this->mergeProfile($defaults, $profile);

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
        $defaults = $this->defaultsForImport($scenario->import);
        $merged = $this->mergeProfile($defaults, $profile);

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
     * @param  array<string, mixed>  $defaults
     * @param  array<string, mixed>  $profile
     * @return array<string, mixed>
     */
    private function mergeProfile(array $defaults, array $profile): array
    {
        $weights = array_merge(
            $defaults['weights'],
            is_array($profile['weights'] ?? null) ? $profile['weights'] : [],
        );

        if (! is_array($weights['criteria_order'] ?? null) || count($weights['criteria_order']) !== 4) {
            $weights['criteria_order'] = $defaults['weights']['criteria_order'];
        }

        return [
            'vacation_bank' => (int) ($profile['vacation_bank'] ?? $defaults['vacation_bank']),
            'weights' => $weights,
            'holiday_rank' => is_array($profile['holiday_rank'] ?? null)
                ? $profile['holiday_rank']
                : $defaults['holiday_rank'],
            'desk_rank' => is_array($profile['desk_rank'] ?? null)
                ? $profile['desk_rank']
                : $defaults['desk_rank'],
            'start_time_rank' => is_array($profile['start_time_rank'] ?? null)
                ? $profile['start_time_rank']
                : $defaults['start_time_rank'],
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
