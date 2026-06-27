<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\CompareScenariosRequest;
use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidScenario;
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
    ) {}

    public function show(Request $request): Response
    {
        $user = $request->user();
        $scenarios = $this->userScenarios($user->id);
        $prefillA = (int) $request->query('scenario_a', 0);
        $prefillB = (int) $request->query('scenario_b', 0);
        $prefillLineIds = $this->parseLineIds($request->query('line_ids'));

        $activeImportId = $this->resolveImportId($scenarios, $prefillA, $prefillB, $request->session()->get(self::SESSION_KEY));
        $lines = $activeImportId !== null
            ? $this->linesForImport($activeImportId)
            : [];

        $comparison = null;
        $stored = $request->session()->get(self::SESSION_KEY);
        if (is_array($stored) && ($stored['rows'] ?? []) !== []) {
            $comparison = [
                'scenario_a' => $stored['scenario_a'],
                'scenario_b' => $stored['scenario_b'],
                'rows' => $stored['rows'],
            ];
            if ($prefillA === 0) {
                $prefillA = (int) ($stored['scenario_a']['id'] ?? 0);
            }
            if ($prefillB === 0) {
                $prefillB = (int) ($stored['scenario_b']['id'] ?? 0);
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
                'scenario_a_id' => $prefillA > 0 ? $prefillA : null,
                'scenario_b_id' => $prefillB > 0 ? $prefillB : null,
                'line_ids' => $prefillLineIds,
            ],
        ]);
    }

    public function compare(CompareScenariosRequest $request): RedirectResponse
    {
        $scenarioA = $this->findScenario($request, (int) $request->validated('scenario_a_id'));
        $scenarioB = $this->findScenario($request, (int) $request->validated('scenario_b_id'));

        if ($scenarioA->bid_import_id !== $scenarioB->bid_import_id) {
            return redirect()
                ->route('bid-tools.scenarios.compare')
                ->with('error', 'Both scenarios must use the same master import.');
        }

        $lineIds = array_values(array_filter(
            $request->validated('line_ids'),
            fn ($id) => BidLine::query()
                ->where('id', $id)
                ->where('bid_import_id', $scenarioA->bid_import_id)
                ->exists(),
        ));

        if ($lineIds === []) {
            return redirect()
                ->route('bid-tools.scenarios.compare')
                ->with('error', 'No valid lines selected.');
        }

        $rows = $this->buildComparisonRows($scenarioA, $scenarioB, $lineIds);

        $request->session()->put(self::SESSION_KEY, [
            'scenario_a' => $this->scenarioSummary($scenarioA),
            'scenario_b' => $this->scenarioSummary($scenarioB),
            'line_ids' => $lineIds,
            'rows' => $rows,
        ]);

        return redirect()->route('bid-tools.scenarios.compare', [
            'scenario_a' => $scenarioA->id,
            'scenario_b' => $scenarioB->id,
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
                    'criteria_order' => is_array($criteriaOrder) ? $criteriaOrder : [],
                    'import_stale' => ! $current || $current->id !== $s->bid_import_id,
                ];
            })
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $scenarios
     * @param  array<string, mixed>|null  $stored
     */
    private function resolveImportId(array $scenarios, int $prefillA, int $prefillB, ?array $stored): ?int
    {
        foreach ([$prefillA, $prefillB] as $id) {
            if ($id <= 0) {
                continue;
            }
            foreach ($scenarios as $scenario) {
                if ($scenario['id'] === $id) {
                    return (int) $scenario['bid_import_id'];
                }
            }
        }

        if (is_array($stored)) {
            $storedA = (int) ($stored['scenario_a']['id'] ?? 0);
            foreach ($scenarios as $scenario) {
                if ($scenario['id'] === $storedA) {
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
            ->orderBy('line_num')
            ->get(['id', 'line_num', 'desk_group', 'start_time'])
            ->map(fn (BidLine $line) => [
                'id' => $line->id,
                'line_num' => $line->line_num,
                'desk_group' => $line->desk_group,
                'start_time' => $line->start_time,
            ])
            ->all();
    }

    /**
     * @param  list<int>  $lineIds
     * @return list<array<string, mixed>>
     */
    private function buildComparisonRows(BidScenario $scenarioA, BidScenario $scenarioB, array $lineIds): array
    {
        $scoresA = $this->scoreService->scoreLines($scenarioA, $lineIds);
        $scoresB = $this->scoreService->scoreLines($scenarioB, $lineIds);

        $byIdB = collect($scoresB)->keyBy('bid_line_id');
        $rankB = [];
        foreach ($scoresB as $index => $row) {
            $rankB[(int) $row['bid_line_id']] = $index + 1;
        }

        $lineModels = BidLine::query()
            ->whereIn('id', $lineIds)
            ->get()
            ->keyBy('id');

        $rows = [];
        foreach ($scoresA as $index => $rowA) {
            $id = (int) $rowA['bid_line_id'];
            $rowB = $byIdB->get($id);
            if ($rowB === null) {
                continue;
            }

            $rankA = $index + 1;
            $rankInB = $rankB[$id] ?? $rankA;
            $lineModel = $lineModels->get($id);

            $rows[] = [
                'bid_line_id' => $id,
                'line_num' => $rowA['line_num'],
                'rank_a' => $rankA,
                'rank_b' => $rankInB,
                'rank_delta' => $rankInB - $rankA,
                'total_a' => $rowA['total'],
                'total_b' => $rowB['total'],
                'total_delta' => round((float) $rowB['total'] - (float) $rowA['total'], 2),
                'parts_a' => $rowA['parts'] ?? [],
                'parts_b' => $rowB['parts'] ?? [],
                'line' => $lineModel ? $this->rowFormatter->format($lineModel) : null,
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
            'criteria_order' => is_array($criteriaOrder) ? $criteriaOrder : [],
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
}
