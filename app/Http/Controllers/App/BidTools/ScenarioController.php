<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\StoreBidScenarioRequest;
use App\Http\Requests\BidTools\UpdateBidScenarioRequest;
use App\Models\BidImport;
use App\Models\BidScenario;
use App\Models\BidScenarioVacationRange;
use App\Services\BidTools\BidLinePickerService;
use App\Services\BidTools\BidLinePreferenceCatalog;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class ScenarioController extends Controller
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly BidLinePreferenceCatalog $preferenceCatalog,
        private readonly BidLinePickerService $linePicker,
    ) {}

    public function create(): Response
    {
        $imports = BidImport::query()
            ->where('is_current', true)
            ->orderByDesc('bid_year')
            ->get(['id', 'bid_year', 'file_hash']);

        return Inertia::render('app/bid-tools/scenarios/create', [
            'imports' => $imports,
        ]);
    }

    public function store(StoreBidScenarioRequest $request): RedirectResponse
    {
        $user = $request->user();
        $import = BidImport::query()->findOrFail($request->validated('bid_import_id'));
        $bidYear = (int) $import->bid_year;

        $deskKeys = $this->preferenceCatalog->deskKeysForImport($import->id);
        $deskRank = $deskKeys === []
            ? $this->scoreService->defaultDeskEntries()
            : $this->scoreService->deskEntriesForEditor([], $deskKeys);

        $scenario = BidScenario::create([
            'user_id' => $user->id,
            'bid_import_id' => $import->id,
            'name' => $request->validated('name'),
            'vacation_bank' => 15,
            'weights' => ScenarioScoreService::defaultWeights(),
            'holiday_rank' => $this->scoreService->defaultHolidayEntries($bidYear),
            'desk_rank' => $deskRank,
            'start_time_rank' => [],
            'personal_dates' => [],
            'code_overrides' => [],
        ]);

        return redirect()
            ->route('bid-tools.scenarios.edit', $scenario->id)
            ->with('success', 'Scenario created.');
    }

    public function edit(Request $request, int $scenario): Response
    {
        $s = $this->findScenario($request, $scenario);
        $s->load(['vacationRanges', 'import']);
        $bidYear = (int) $s->import->bid_year;

        $weights = array_merge(
            ScenarioScoreService::defaultWeights(),
            $s->weights ?? [],
        );
        $weights['criteria_order'] = ScenarioScoreService::normalizeCriteriaOrder($weights['criteria_order'] ?? null);
        $weights['start_time_tiebreak_order'] = ScenarioScoreService::normalizeStartTimeTiebreakOrder(
            $weights['start_time_tiebreak_order'] ?? $weights['shift_order'] ?? null,
        );
        $weights['sort_mode'] = ScenarioScoreService::normalizeSortMode($weights['sort_mode'] ?? null);
        unset($weights['shift_order'], $weights['strict_shift_order'], $weights['strict_shift_rank'], $weights['start_time']);

        $deskKeys = $this->preferenceCatalog->deskKeysForImport($s->bid_import_id);

        return Inertia::render('app/bid-tools/scenarios/edit', [
            'scenario' => [
                'id' => $s->id,
                'name' => $s->name,
                'bid_import_id' => $s->bid_import_id,
                'vacation_bank' => $s->vacation_bank,
                'weights' => $weights,
                'holiday_rank' => $this->scoreService->holidayEntriesForEditor($s->holiday_rank, $bidYear),
                'desk_rank' => $this->scoreService->deskEntriesForEditor($s->desk_rank, $deskKeys),
                'personal_dates' => $this->scoreService->personalDatesForEditor($s->personal_dates ?? []),
                'code_overrides' => $s->code_overrides ?? [],
                'import' => [
                    'bid_year' => $s->import->bid_year,
                    'file_hash' => $s->import->file_hash,
                    'is_current' => $s->import->is_current,
                ],
                'vacation_ranges' => $s->vacationRanges->map(fn ($r) => [
                    'id' => $r->id,
                    'title' => $r->title,
                    'starts_on' => $r->starts_on->format('Y-m-d'),
                    'ends_on' => $r->ends_on->format('Y-m-d'),
                ]),
            ],
            'distinctCodes' => $s->import->meta['distinct_codes'] ?? [],
            'holidaysCatalog' => $this->scoreService->holidaysCatalog($bidYear),
            'deskCatalog' => $this->preferenceCatalog->deskCatalogForImport($s->bid_import_id),
            'lines' => $this->linePicker->rowsForImport($s->bid_import_id, $s->id),
        ]);
    }

    public function update(UpdateBidScenarioRequest $request, int $scenario): RedirectResponse
    {
        $s = $this->findScenario($request, $scenario);
        $data = $request->validated();

        if (array_key_exists('vacation_ranges', $data)) {
            $s->vacationRanges()->delete();
            foreach ($data['vacation_ranges'] ?? [] as $range) {
                BidScenarioVacationRange::create([
                    'bid_scenario_id' => $s->id,
                    'title' => $range['title'] ?? null,
                    'starts_on' => $range['starts_on'],
                    'ends_on' => $range['ends_on'],
                ]);
            }
            unset($data['vacation_ranges']);
        }

        $fillKeys = [
            'name', 'vacation_bank', 'weights', 'holiday_rank', 'desk_rank',
            'personal_dates', 'code_overrides',
        ];
        $payload = Arr::only($data, $fillKeys);
        $payload['desk_rank'] = $payload['desk_rank'] ?? [];
        $payload['personal_dates'] = $payload['personal_dates'] ?? [];
        $s->fill($payload);
        $s->save();

        return back()->with('success', 'Scenario saved.');
    }

    public function duplicate(Request $request, int $scenario): RedirectResponse
    {
        $source = $this->findScenario($request, $scenario);
        $source->load('vacationRanges');

        $copy = BidScenario::create([
            'user_id' => $request->user()->id,
            'bid_import_id' => $source->bid_import_id,
            'name' => $this->duplicateScenarioName($request->user()->id, $source->name),
            'vacation_bank' => $source->vacation_bank,
            'weights' => $source->weights,
            'holiday_rank' => $source->holiday_rank,
            'desk_rank' => $source->desk_rank,
            'start_time_rank' => $source->start_time_rank ?? [],
            'personal_dates' => $source->personal_dates,
            'code_overrides' => $source->code_overrides ?? [],
        ]);

        foreach ($source->vacationRanges as $range) {
            BidScenarioVacationRange::create([
                'bid_scenario_id' => $copy->id,
                'title' => $range->title,
                'starts_on' => $range->starts_on,
                'ends_on' => $range->ends_on,
            ]);
        }

        return redirect()
            ->route('bid-tools.scenarios.edit', $copy->id)
            ->with('success', 'Scenario duplicated. Adjust the copy as needed.');
    }

    public function destroy(Request $request, int $scenario): RedirectResponse
    {
        $s = $this->findScenario($request, $scenario);
        $s->delete();

        return redirect()
            ->route('bid-tools.index')
            ->with('success', 'Scenario deleted.');
    }

    private function findScenario(Request $request, int $id): BidScenario
    {
        return BidScenario::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);
    }

    private function duplicateScenarioName(int $userId, string $name): string
    {
        $base = preg_replace('/ \(\d+\)$/', '', trim($name)) ?: 'Scenario';
        $candidate = $base.' (copy)';
        $suffix = 2;

        while (BidScenario::query()
            ->where('user_id', $userId)
            ->where('name', $candidate)
            ->exists()) {
            $candidate = $base.' (copy '.$suffix.')';
            $suffix++;
        }

        return $candidate;
    }
}
