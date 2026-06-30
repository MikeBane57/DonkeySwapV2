<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidLinePreferenceCatalog;
use App\Services\BidTools\RankTierHelper;
use App\Services\BidTools\ScenarioScoreService;

test('equal start time tiers score the same within a tier group', function () {
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

    $startKeys = app(BidLinePreferenceCatalog::class)
        ->startTimeKeysForImport($import->id);

    $startRank = [
        ['key' => 't_0600', 'priority' => 'high', 'tier' => 1],
        ['key' => 't_0700', 'priority' => 'high', 'tier' => 1],
        ['key' => 't_1500', 'priority' => 'high', 'tier' => 2],
    ];

    foreach ($startKeys as $key) {
        if (! in_array($key, ['t_0600', 't_0700', 't_1500'], true)) {
            $startRank[] = ['key' => $key, 'priority' => 'ignore', 'tier' => 3];
        }
    }

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Tier groups',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'start_time' => 1,
            'desk' => 0,
            'vacation_penalty' => 0,
            'sort_mode' => 'blended',
            'criteria_order' => ['start_time', 'holiday', 'personal', 'desk'],
        ],
        'holiday_rank' => [],
        'desk_rank' => [],
        'start_time_rank' => $startRank,
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$amLine->id, $pmLine->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$amLine->id]['parts']['start_time'])
        ->toBeGreaterThan($byId[$pmLine->id]['parts']['start_time']);
    expect($scores[0]['bid_line_id'])->toBe($amLine->id);
});

test('equal desk tiers score sector and router the same', function () {
    $entries = [
        ['key' => 'XS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'XR', 'priority' => 'high', 'tier' => 1],
        ['key' => 'XG', 'priority' => 'low', 'tier' => 2],
    ];

    $xsWeight = RankTierHelper::tierWeight($entries, 0);
    $xrWeight = RankTierHelper::tierWeight($entries, 1);
    $xgWeight = RankTierHelper::tierWeight($entries, 2);

    expect($xsWeight)->toBe($xrWeight);
    expect($xsWeight)->toBeGreaterThan($xgWeight);
});
