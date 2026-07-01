<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidLinePreferenceCatalog;
use App\Services\BidTools\RankTierHelper;
use App\Services\BidTools\ScenarioScoreService;

test('tier rank for key treats grouped entries as the same rank', function () {
    $entries = [
        ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'low', 'tier' => 1],
        ['key' => 'AG', 'priority' => 'high', 'tier' => 2],
    ];

    expect(RankTierHelper::tierRankForKey($entries, 'DG'))->toBe(1);
    expect(RankTierHelper::tierRankForKey($entries, 'DR'))->toBe(1);
    expect(RankTierHelper::tierRankForKey($entries, 'AG'))->toBe(2);
});

test('blended mode ranks desk tier before start time tiebreak when totals match', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeDeskStartTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'desk-start.csv',
        $user->id,
        $bidYear,
        null,
        'Desk start import',
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();
    $dg0600 = $lines->firstWhere('line_num', '551');
    $ds0600 = $lines->firstWhere('line_num', '552');
    $dg0700 = $lines->firstWhere('line_num', '553');

    $deskKeys = app(BidLinePreferenceCatalog::class)
        ->deskKeysForImport($import->id);

    $deskRank = collect($deskKeys)->map(fn (string $key) => [
        'key' => $key,
        'priority' => 'high',
        'tier' => match ($key) {
            'DS', 'DR' => 1,
            'DG' => 2,
            default => 3,
        },
    ])->values()->all();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Blended desk groups',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 1,
            'vacation_penalty' => 0,
            'sort_mode' => 'blended',
            'criteria_order' => ['desk', 'holiday', 'personal'],
            'start_time_tiebreak_order' => ['6', '7', '14', '15', '22'],
        ],
        'holiday_rank' => [],
        'desk_rank' => $deskRank,
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$dg0600->id, $ds0600->id, $dg0700->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$ds0600->id]['tier_ranks']['desk'])
        ->toBeLessThan($byId[$dg0600->id]['tier_ranks']['desk']);
    expect($scores[0]['bid_line_id'])->toBe($ds0600->id);
    expect($scores[1]['bid_line_id'])->toBe($dg0600->id);
});
