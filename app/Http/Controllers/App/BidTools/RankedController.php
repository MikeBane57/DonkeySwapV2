<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\ScoreBidLinesRequest;
use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\BidScenarioLineNote;
use App\Services\BidTools\BidLinePickerService;
use App\Services\BidTools\LineRowFormatter;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RankedController extends Controller
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly LineRowFormatter $rowFormatter,
        private readonly BidLinePickerService $linePicker,
    ) {}

    public function show(Request $request, int $scenario): Response
    {
        $s = $this->findScenario($request, $scenario);
        $s->load('import');

        $lineRows = $this->linePicker->rowsForImport($s->bid_import_id, $s->id);

        $notes = BidScenarioLineNote::query()
            ->where('bid_scenario_id', $s->id)
            ->get()
            ->keyBy('bid_line_id');

        $rawScores = $request->session()->get($this->scoresSessionKey($scenario));
        $scoredRows = null;
        if (is_array($rawScores) && $rawScores !== []) {
            $lineModels = BidLine::query()
                ->whereIn('id', collect($rawScores)->pluck('bid_line_id')->all())
                ->get()
                ->keyBy('id');
            $rank = 1;
            $scoredRows = [];
            foreach ($rawScores as $row) {
                $id = (int) $row['bid_line_id'];
                $lm = $lineModels->get($id);
                $fmt = $lm ? $this->rowFormatter->format($lm) : null;
                $scoredRows[] = [
                    'rank' => $rank++,
                    'bid_line_id' => $id,
                    'line_num' => $row['line_num'],
                    'total' => $row['total'],
                    'parts' => $row['parts'] ?? [],
                    'line' => $fmt,
                    'submitted_externally' => (bool) ($notes[$id]->submitted_externally ?? false),
                ];
            }
        }

        return Inertia::render('app/bid-tools/scenarios/ranked', [
            'scenario' => [
                'id' => $s->id,
                'name' => $s->name,
                'vacation_bank' => $s->vacation_bank,
                'import_stale' => ! $s->import->is_current,
            ],
            'lines' => $lineRows,
            'scored_rows' => $scoredRows,
        ]);
    }

    public function score(ScoreBidLinesRequest $request, int $scenario): RedirectResponse
    {
        $s = $this->findScenario($request, $scenario);
        $s->load('import');

        $ids = $request->validated('line_ids');
        $ids = array_values(array_filter($ids, fn ($id) => BidLine::query()
            ->where('id', $id)
            ->where('bid_import_id', $s->bid_import_id)
            ->exists()));

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
