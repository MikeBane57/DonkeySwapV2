<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\ScenarioScoreService;

test('line ranking sorts by total score before criteria tie-break order', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 2);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Sort import',
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();
    expect($lines)->toHaveCount(2);

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Sort test',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 5,
            'personal' => 0,
            'desk' => 0.1,
            'vacation_penalty' => 0,
            'sort_mode' => 'weighted',
            'criteria_order' => ['holiday', 'personal', 'desk'],
        ],
        'holiday_rank' => [],
        'desk_rank' => [],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        $lines->pluck('id')->all(),
    );

    expect($scores)->toHaveCount(2);
    expect($scores[0]['total'])->toBeGreaterThanOrEqual($scores[1]['total']);
});

test('blended sort mode ranks by category order before total score', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeStartTimeHolidayTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'tradeoff.csv',
        $user->id,
        $bidYear,
        null,
        'Priority sort import',
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();
    expect($lines)->toHaveCount(2);

    $amLine = $lines->firstWhere('line_num', '551');
    $pmLine = $lines->firstWhere('line_num', '552');
    expect($amLine)->not->toBeNull();
    expect($pmLine)->not->toBeNull();

    $baseWeights = [
        'holiday' => 10,
        'personal' => 0,
        'desk' => 1,
        'vacation_penalty' => 0,
        'criteria_order' => ['desk', 'holiday', 'personal'],
    ];

    $deskRank = [
        ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ['key' => 'AG', 'priority' => 'low', 'tier' => 2],
    ];

    $weightedScenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Weighted holidays win',
        'vacation_bank' => 10,
        'weights' => array_merge($baseWeights, ['sort_mode' => 'weighted']),
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => $deskRank,
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $priorityScenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Blended desk wins',
        'vacation_bank' => 10,
        'weights' => array_merge($baseWeights, ['sort_mode' => 'blended']),
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => $deskRank,
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $lineIds = [$amLine->id, $pmLine->id];
    $scoreService = app(ScenarioScoreService::class);

    $weightedScores = $scoreService->scoreLines($weightedScenario, $lineIds);
    $priorityScores = $scoreService->scoreLines($priorityScenario, $lineIds);

    $weightedById = collect($weightedScores)->keyBy('bid_line_id');
    $priorityById = collect($priorityScores)->keyBy('bid_line_id');

    expect($weightedById[$pmLine->id]['total'])->toBeGreaterThan($weightedById[$amLine->id]['total']);
    expect($weightedScores[0]['bid_line_id'])->toBe($pmLine->id);

    expect($priorityById[$amLine->id]['parts']['desk'])
        ->toBeGreaterThan($priorityById[$pmLine->id]['parts']['desk']);
    expect($priorityScores[0]['bid_line_id'])->toBe($amLine->id);
});

test('blended mode honors category order even when criterion weights are zero', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeStartTimeHolidayTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'zero-weight.csv',
        $user->id,
        $bidYear,
        null,
        'Zero weight import',
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();
    $amLine = $lines->firstWhere('line_num', '551');
    $pmLine = $lines->firstWhere('line_num', '552');

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Holiday category first',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 0,
            'vacation_penalty' => 0,
            'sort_mode' => 'blended',
            'criteria_order' => ['holiday', 'desk', 'personal'],
        ],
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => [
            ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
            ['key' => 'AG', 'priority' => 'high', 'tier' => 2],
        ],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$amLine->id, $pmLine->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$pmLine->id]['tier_ranks']['holiday'])
        ->toBeLessThan($byId[$amLine->id]['tier_ranks']['holiday']);
    expect($scores[0]['bid_line_id'])->toBe($pmLine->id);
});
