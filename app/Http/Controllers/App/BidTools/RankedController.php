<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\PreviewScenarioScoreRequest;
use App\Http\Requests\BidTools\ScoreBidLinesRequest;
use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\BidScenarioLineNote;
use App\Services\BidTools\BidLinePickerService;
use App\Services\BidTools\BidLinePreferenceCatalog;
use App\Services\BidTools\ScenarioScoreService;
use App\Services\BidTools\ScoredLineResponseFormatter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class RankedController extends Controller
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly BidLinePickerService $linePicker,
        private readonly BidLinePreferenceCatalog $preferenceCatalog,
        private readonly ScoredLineResponseFormatter $scoredLineFormatter,
    ) {}

    public function show(Request $request, int $scenario): Response
    {
        $s = $this->findScenario($request, $scenario);
        $s->load(['import', 'vacationRanges']);
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

        $deskKeys = $this->preferenceCatalog->deskKeysForImport(
            $s->bid_import_id,
            $s->desk_bucket_mappings ?? [],
            $s->line_desk_buckets ?? [],
        );

        $lineRows = $this->linePicker->rowsForImport($s->bid_import_id, $s->id);

        $legacyRanges = $s->vacationRanges->map(fn ($r) => [
            'title' => $r->title ?? '',
            'starts_on' => $r->starts_on->format('Y-m-d'),
            'ends_on' => $r->ends_on->format('Y-m-d'),
        ])->all();

        return Inertia::render('app/bid-tools/scenarios/ranked', [
            'scenario' => [
                'id' => $s->id,
                'name' => $s->name,
                'vacation_bank' => $s->vacation_bank,
                'import_stale' => ! $s->import->is_current,
                'import' => [
                    'bid_year' => $s->import->bid_year,
                ],
                'weights' => $weights,
                'holiday_rank' => $this->scoreService->holidayEntriesForEditor($s->holiday_rank, $bidYear),
                'desk_rank' => $this->scoreService->deskEntriesForEditor($s->desk_rank, $deskKeys),
                'personal_dates' => $this->scoreService->personalDatesForEditor(
                    $s->personal_dates ?? [],
                    $legacyRanges,
                ),
            ],
            'holidaysCatalog' => $this->scoreService->holidaysCatalog($bidYear),
            'deskCatalog' => $this->preferenceCatalog->deskCatalogForImport($s->bid_import_id),
            'lines' => $lineRows,
        ]);
    }

    public function previewScore(PreviewScenarioScoreRequest $request, int $scenario): JsonResponse
    {
        $s = $this->findScenario($request, $scenario);
        $s->load(['import']);

        $working = $this->scenarioWithPreviewPayload($s, $request->validated());
        $lineIds = $this->filterLineIds($s, $request->validated('line_ids'));

        if ($lineIds === []) {
            return response()->json(['scored_rows' => [], 'sort_explanation' => null]);
        }

        $scores = $this->scoreService->scoreLines($working, $lineIds);
        $notes = BidScenarioLineNote::query()
            ->where('bid_scenario_id', $s->id)
            ->get()
            ->keyBy('bid_line_id');

        return response()->json(
            $this->scoredLineFormatter->format($working, $scores, $notes),
        );
    }

    public function score(ScoreBidLinesRequest $request, int $scenario): RedirectResponse
    {
        $s = $this->findScenario($request, $scenario);
        $s->load('import');

        $ids = $this->filterLineIds($s, $request->validated('line_ids'));

        if ($ids === []) {
            return redirect()
                ->route('bid-tools.scenarios.ranked', $scenario)
                ->with('error', 'No valid lines selected.');
        }

        $scores = $this->scoreService->scoreLines($s, $ids);
        $request->session()->put(
            $this->scoresSessionKey($scenario),
            $this->slimScoresForSession($scores),
        );

        return redirect()->route('bid-tools.scenarios.ranked', $scenario);
    }

    public function updateSubmitted(Request $request, int $scenario, int $line): RedirectResponse
    {
        $s = $this->findScenario($request, $scenario);
        $lineModel = BidLine::query()
            ->where('bid_import_id', $s->bid_import_id)
            ->where('id', $line)
            ->firstOrFail();

        $request->validate([
            'submitted_externally' => ['required', 'boolean'],
        ]);

        BidScenarioLineNote::query()->updateOrCreate(
            [
                'bid_scenario_id' => $s->id,
                'bid_line_id' => $lineModel->id,
            ],
            [
                'submitted_externally' => $request->boolean('submitted_externally'),
            ],
        );

        return back();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function scenarioWithPreviewPayload(BidScenario $scenario, array $payload): BidScenario
    {
        $working = clone $scenario;

        $fillKeys = [
            'vacation_bank', 'weights', 'holiday_rank', 'desk_rank',
            'personal_dates', 'desk_bucket_mappings', 'line_desk_buckets',
        ];

        $overrides = Arr::only($payload, $fillKeys);
        if ($overrides !== []) {
            $working->fill($overrides);
        }

        return $working;
    }

    /**
     * @param  list<int>  $rawIds
     * @return list<int>
     */
    private function filterLineIds(BidScenario $scenario, array $rawIds): array
    {
        return array_values(array_filter($rawIds, fn ($id) => BidLine::query()
            ->where('id', $id)
            ->where('bid_import_id', $scenario->bid_import_id)
            ->exists()));
    }

    private function findScenario(Request $request, int $id): BidScenario
    {
        return BidScenario::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);
    }

    private function scoresSessionKey(int $scenarioId): string
    {
        return 'bid_scores.scenario.'.$scenarioId;
    }

    /**
     * @param  list<array<string, mixed>>  $scores
     * @return list<array{bid_line_id: int, line_num: string, total: float|int, parts: array<string, float>}>
     */
    private function slimScoresForSession(array $scores): array
    {
        return array_map(fn (array $row) => [
            'bid_line_id' => (int) $row['bid_line_id'],
            'line_num' => (string) $row['line_num'],
            'total' => $row['total'],
            'parts' => $row['parts'] ?? [],
        ], $scores);
    }
}
