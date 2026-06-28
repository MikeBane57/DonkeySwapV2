<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\CompareScenariosRequest;
use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidScenario;
use App\Services\BidTools\CondensedDeskClassifier;
use App\Services\BidTools\LineRowFormatter;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ScenarioCompareController extends Controller
{
    private const SESSION_KEY = 'bid_scenario_compare';

    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly LineRowFormatter $rowFormatter,
        private readonly CondensedDeskClassifier $deskClassifier,
    ) {}

    public function show(Request $request): Response
    {
        $user = $request->user();
        $scenarios = $this->userScenarios($user->id);
        $prefillScenarioIds = $this->parseScenarioIds(
            $request->query('scenarios', $request->query('scenario_ids')),
        );
        $prefillLineIds = $this->parseLineIds($request->query('line_ids'));

        $activeImportId = $this->resolveImportId($scenarios, $prefillScenarioIds, $request->session()->get(self::SESSION_KEY));
        $lines = $activeImportId !== null
            ? $this->linesForImport($activeImportId)
            : [];

        $comparison = null;
        $stored = $request->session()->get(self::SESSION_KEY);
        if (is_array($stored) && ($stored['rows'] ?? []) !== []) {
            $comparison = [
                'scenarios' => $stored['scenarios'],
                'rows' => $stored['rows'],
            ];
            if ($prefillScenarioIds === []) {
                $prefillScenarioIds = collect($stored['scenarios'] ?? [])
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->all();
            }
            if ($prefillLineIds === []) {
                $prefillLineIds = $stored['line_ids'] ?? [];
            }
        }

        return Inertia::render('app/bid-tools/scenarios/compare', [
            'scenarios' => $scenarios,
            'lines' => $lines,
            'comparison' => $comparison,
            'prefill' => [
                'scenario_ids' => $prefillScenarioIds,
                'line_ids' => $prefillLineIds,
            ],
        ]);
    }

    public function compare(CompareScenariosRequest $request): RedirectResponse
    {
        $scenarioIds = array_values(array_unique(array_map('intval', $request->validated('scenario_ids'))));
        $scenarios = collect($scenarioIds)
            ->map(fn (int $id) => $this->findScenario($request, $id))
            ->values()
            ->all();

        $importId = $scenarios[0]->bid_import_id;
        foreach ($scenarios as $scenario) {
            if ($scenario->bid_import_id !== $importId) {
                return redirect()
                    ->route('bid-tools.scenarios.compare')
                    ->with('error', 'All selected scenarios must use the same master import.');
            }
        }

        $lineIds = array_values(array_filter(
            $request->validated('line_ids'),
            fn ($id) => BidLine::query()
                ->where('id', $id)
                ->where('bid_import_id', $importId)
                ->exists(),
        ));

        if ($lineIds === []) {
            return redirect()
                ->route('bid-tools.scenarios.compare')
                ->with('error', 'No valid lines selected.');
        }

        $rows = $this->buildComparisonRows($scenarios, $lineIds);

        $request->session()->put(self::SESSION_KEY, [
            'scenarios' => array_map(fn (BidScenario $s) => $this->scenarioSummary($s), $scenarios),
            'line_ids' => $lineIds,
            'rows' => $rows,
        ]);

        return redirect()->route('bid-tools.scenarios.compare', [
            'scenarios' => implode(',', $scenarioIds),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function userScenarios(int $userId): array
    {
        return BidScenario::query()
            ->where('user_id', $userId)
            ->with('import:id,bid_year,is_current')
            ->orderByDesc('updated_at')
            ->get()
            ->map(function (BidScenario $s) {
                $current = BidImport::query()
                    ->where('bid_year', $s->import->bid_year)
                    ->where('is_current', true)
                    ->first();

                $weights = $s->weights ?? [];
                $criteriaOrder = $weights['criteria_order'] ?? ['holiday', 'personal', 'start_time', 'desk'];

                return [
                    'id' => $s->id,
                    'name' => $s->name,
                    'bid_import_id' => $s->bid_import_id,
                    'bid_year' => $s->import->bid_year,
                    'vacation_bank' => $s->vacation_bank,
                    'sort_mode' => ScenarioScoreService::normalizeSortMode($weights['sort_mode'] ?? null),
                    'criteria_order' => ScenarioScoreService::normalizeCriteriaOrder($criteriaOrder),
                    'import_stale' => ! $current || $current->id !== $s->bid_import_id,
                ];
            })
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $scenarios
     * @param  list<int>  $prefillScenarioIds
     * @param  array<string, mixed>|null  $stored
     */
    private function resolveImportId(array $scenarios, array $prefillScenarioIds, ?array $stored): ?int
    {
        foreach ($prefillScenarioIds as $id) {
            if ($id <= 0) {
                continue;
            }
            foreach ($scenarios as $scenario) {
                if ($scenario['id'] === $id) {
                    return (int) $scenario['bid_import_id'];
                }
            }
        }

        if (is_array($stored) && ($stored['scenarios'] ?? []) !== []) {
            $storedId = (int) ($stored['scenarios'][0]['id'] ?? 0);
            foreach ($scenarios as $scenario) {
                if ($scenario['id'] === $storedId) {
                    return (int) $scenario['bid_import_id'];
                }
            }
        }

        return isset($scenarios[0]) ? (int) $scenarios[0]['bid_import_id'] : null;
    }

    /**
     * @return list<array{id: int, line_num: string, desk_group: string, start_time: string}>
     */
    private function linesForImport(int $importId): array
    {
        return BidLine::query()
            ->where('bid_import_id', $importId)
            ->with('days')
            ->orderBy('line_num')
            ->get()
            ->map(fn (BidLine $line) => $this->deskClassifier->linePickerFields($line))
            ->all();
    }

    /**
     * @param  list<BidScenario>  $scenarios
     * @param  list<int>  $lineIds
     * @return list<array<string, mixed>>
     */
    private function buildComparisonRows(array $scenarios, array $lineIds): array
    {
        $scoresByScenario = [];
        $ranksByScenario = [];

        foreach ($scenarios as $scenario) {
            $scores = $this->scoreService->scoreLines($scenario, $lineIds);
            $scoresByScenario[$scenario->id] = collect($scores)->keyBy('bid_line_id');
            $ranks = [];
            foreach ($scores as $index => $row) {
                $ranks[(int) $row['bid_line_id']] = $index + 1;
            }
            $ranksByScenario[$scenario->id] = $ranks;
        }

        $baseline = $scenarios[0];
        $baselineScores = $this->scoreService->scoreLines($baseline, $lineIds);

        $lineModels = BidLine::query()
            ->whereIn('id', $lineIds)
            ->get()
            ->keyBy('id');

        $rows = [];
        foreach ($baselineScores as $rowBaseline) {
            $id = (int) $rowBaseline['bid_line_id'];
            $scenarioResults = [];

            foreach ($scenarios as $scenario) {
                $row = $scoresByScenario[$scenario->id]->get($id);
                if ($row === null) {
                    continue 2;
                }

                $scenarioResults[] = [
                    'scenario_id' => $scenario->id,
                    'rank' => $ranksByScenario[$scenario->id][$id],
                    'total' => $row['total'],
                    'parts' => $row['parts'] ?? [],
                ];
            }

            $lineModel = $lineModels->get($id);

            $rows[] = [
                'bid_line_id' => $id,
                'line_num' => $rowBaseline['line_num'],
                'line' => $lineModel ? $this->rowFormatter->format($lineModel) : null,
                'scenarios' => $scenarioResults,
            ];
        }

        return $rows;
    }

    /**
     * @return array<string, mixed>
     */
    private function scenarioSummary(BidScenario $scenario): array
    {
        $scenario->loadMissing('import');
        $current = BidImport::query()
            ->where('bid_year', $scenario->import->bid_year)
            ->where('is_current', true)
            ->first();
        $weights = $scenario->weights ?? [];
        $criteriaOrder = $weights['criteria_order'] ?? ['holiday', 'personal', 'start_time', 'desk'];

        return [
            'id' => $scenario->id,
            'name' => $scenario->name,
            'bid_year' => $scenario->import->bid_year,
            'vacation_bank' => $scenario->vacation_bank,
            'weights' => [
                'holiday' => (float) ($weights['holiday'] ?? 1),
                'personal' => (float) ($weights['personal'] ?? 1),
                'start_time' => (float) ($weights['start_time'] ?? 1),
                'desk' => (float) ($weights['desk'] ?? 1),
                'vacation_penalty' => (float) ($weights['vacation_penalty'] ?? 1),
            ],
            'sort_mode' => ScenarioScoreService::normalizeSortMode($weights['sort_mode'] ?? null),
            'criteria_order' => ScenarioScoreService::normalizeCriteriaOrder($criteriaOrder),
            'import_stale' => ! $current || $current->id !== $scenario->bid_import_id,
        ];
    }

    private function findScenario(Request $request, int $id): BidScenario
    {
        return BidScenario::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);
    }

    /**
     * @return list<int>
     */
    private function parseLineIds(mixed $raw): array
    {
        if (is_string($raw) && $raw !== '') {
            $raw = explode(',', $raw);
        }
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_filter(array_map('intval', $raw)));
    }

    /**
     * @return list<int>
     */
    private function parseScenarioIds(mixed $raw): array
    {
        if (is_string($raw) && $raw !== '') {
            $raw = explode(',', $raw);
        }
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map('intval', $raw))));
    }
}
