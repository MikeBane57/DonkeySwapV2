<?php

namespace App\Http\Controllers\Api\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\PreviewScoreBidLinesRequest;
use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\BidScenarioLineNote;
use App\Services\BidTools\BidScenarioProfileBuilder;
use App\Services\BidTools\LineRowFormatter;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Http\JsonResponse;

class ScenarioPreviewScoreController extends Controller
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly LineRowFormatter $rowFormatter,
        private readonly BidScenarioProfileBuilder $profileBuilder,
    ) {}

    public function __invoke(PreviewScoreBidLinesRequest $request, int $scenario): JsonResponse
    {
        $s = BidScenario::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($scenario);

        $ids = $request->validated('line_ids');
        $ids = array_values(array_filter($ids, fn ($id) => BidLine::query()
            ->where('id', $id)
            ->where('bid_import_id', $s->bid_import_id)
            ->exists()));

        if ($ids === []) {
            return response()->json(['errors' => ['line_ids' => ['No valid lines selected.']]], 422);
        }

        $draft = $request->validated('draft') ?? [];
        if ($draft !== []) {
            $s->load('import');
            $draft = $this->profileBuilder->prepareDraftForScoring($s->import, $draft);
        }

        $scores = $draft === []
            ? $this->scoreService->scoreLines($s, $ids)
            : $this->scoreService->scoreLinesWithDraft($s, $draft, $ids);

        $lineModels = BidLine::query()
            ->whereIn('id', collect($scores)->pluck('bid_line_id')->all())
            ->get()
            ->keyBy('id');

        $notes = BidScenarioLineNote::query()
            ->where('bid_scenario_id', $s->id)
            ->get()
            ->keyBy('bid_line_id');

        $rank = 1;
        $rows = [];
        foreach ($scores as $row) {
            $id = (int) $row['bid_line_id'];
            $lm = $lineModels->get($id);
            $fmt = $lm ? $this->rowFormatter->format($lm) : null;
            $rows[] = [
                'rank' => $rank++,
                'bid_line_id' => $id,
                'line_num' => $row['line_num'],
                'total' => $row['total'],
                'parts' => $row['parts'] ?? [],
                'line' => $fmt,
                'submitted_externally' => (bool) ($notes[$id]->submitted_externally ?? false),
            ];
        }

        return response()->json(['scored_rows' => $rows]);
    }
}
