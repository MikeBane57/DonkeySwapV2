<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\RankTierHelper;
use App\Services\BidTools\ScenarioScoreService;

test('equal desk tiers score sector and router buckets the same', function () {
    $entries = [
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DG', 'priority' => 'low', 'tier' => 2],
    ];

    $dsWeight = RankTierHelper::tierWeight($entries, 0);
    $drWeight = RankTierHelper::tierWeight($entries, 1);
    $dgWeight = RankTierHelper::tierWeight($entries, 2);

    expect($dsWeight)->toBe($drWeight);
    expect($dsWeight)->toBeGreaterThan($dgWeight);
});

test('blended mode ranks higher desk tier before lower when totals match', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeStartTimeHolidayTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'tier.csv',
        $user->id,
        $bidYear,
        null,
        'Tier import',
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();
    $amLine = $lines->firstWhere('line_num', '551');
    $pmLine = $lines->firstWhere('line_num', '552');

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Tier groups',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 1,
            'vacation_penalty' => 0,
            'sort_mode' => 'blended',
            'criteria_order' => ['desk', 'holiday', 'personal'],
        ],
        'holiday_rank' => [],
        'desk_rank' => [
            ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
            ['key' => 'AG', 'priority' => 'low', 'tier' => 2],
        ],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$amLine->id, $pmLine->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$amLine->id]['parts']['desk'])
        ->toBeGreaterThan($byId[$pmLine->id]['parts']['desk']);
    expect($scores[0]['bid_line_id'])->toBe($amLine->id);
});
