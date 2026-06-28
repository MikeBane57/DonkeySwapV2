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
            'start_time' => 0.1,
            'desk' => 0.1,
            'vacation_penalty' => 0,
            'sort_mode' => 'weighted',
            'criteria_order' => ['holiday', 'personal', 'start_time', 'desk'],
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

test('priority sort mode ranks by category order before total score', function () {
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

    $startKeys = app(\App\Services\BidTools\BidLinePreferenceCatalog::class)
        ->startTimeKeysForImport($import->id);

    $startRank = collect($startKeys)->map(fn (string $key) => [
        'key' => $key,
        'priority' => match ($key) {
            't_0600' => 'high',
            't_1500' => 'low',
            default => 'ignore',
        },
    ])->values()->all();

    $baseWeights = [
        'holiday' => 10,
        'personal' => 0,
        'start_time' => 1,
        'desk' => 0,
        'vacation_penalty' => 0,
        'criteria_order' => ['start_time', 'holiday', 'personal', 'desk'],
    ];

    $weightedScenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Weighted holidays win',
        'vacation_bank' => 10,
        'weights' => array_merge($baseWeights, ['sort_mode' => 'weighted']),
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => [],
        'start_time_rank' => $startRank,
        'personal_dates' => [],
    ]);

    $priorityScenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Priority start time wins',
        'vacation_bank' => 10,
        'weights' => array_merge($baseWeights, ['sort_mode' => 'priority']),
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => [],
        'start_time_rank' => $startRank,
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

    expect($priorityById[$amLine->id]['parts']['start_time'])
        ->toBeGreaterThan($priorityById[$pmLine->id]['parts']['start_time']);
    expect($priorityScores[0]['bid_line_id'])->toBe($amLine->id);
});
