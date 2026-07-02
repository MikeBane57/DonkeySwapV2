<?php

namespace App\Http\Controllers\Api\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\PreviewScoreBidLinesRequest;
use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\BidScenarioLineNote;
use App\Services\BidTools\BidScenarioProfileBuilder;
use App\Services\BidTools\ScenarioScoreService;
use App\Services\BidTools\ScoredLineResponseFormatter;
use Illuminate\Http\JsonResponse;

class ScenarioPreviewScoreController extends Controller
{
    public function __construct(
        private readonly ScenarioScoreService $scoreService,
        private readonly BidScenarioProfileBuilder $profileBuilder,
        private readonly ScoredLineResponseFormatter $scoredLineFormatter,
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

        $notes = BidScenarioLineNote::query()
            ->where('bid_scenario_id', $s->id)
            ->get()
            ->keyBy('bid_line_id');

        $working = clone $s;
        if ($draft !== []) {
            foreach (['vacation_bank', 'weights', 'holiday_rank', 'desk_rank', 'personal_dates', 'desk_bucket_mappings', 'line_desk_buckets'] as $key) {
                if (array_key_exists($key, $draft)) {
                    $working->setAttribute($key, $draft[$key]);
                }
            }
        }

        return response()->json(
            $this->scoredLineFormatter->format($working, $scores, $notes),
        );
    }
}
