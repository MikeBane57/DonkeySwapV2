<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\ScenarioScoreService;

test('blended mode ranks pm desk tier before mid even when mid scores higher', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMidPmDeskTierCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'pm-mid.csv',
        $user->id,
        $bidYear,
        null,
        'PM vs Mid import',
    )['import'];

    @unlink($path);

    $midLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '551')->firstOrFail();
    $pmLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '552')->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'PM before Mid',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 5,
            'personal' => 0,
            'desk' => 1,
            'vacation_penalty' => 0,
            'sort_mode' => 'blended',
            'criteria_order' => ['desk', 'holiday', 'personal'],
        ],
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => [
            ['key' => 'AG', 'priority' => 'high', 'tier' => 2],
            ['key' => 'MID', 'priority' => 'high', 'tier' => 3],
        ],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$midLine->id, $pmLine->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$pmLine->id]['breakdown']['group_bucket'])->toBe('AG');
    expect($byId[$midLine->id]['breakdown']['group_bucket'])->toBe('MID');
    expect($byId[$pmLine->id]['tier_ranks']['desk'])
        ->toBeLessThan($byId[$midLine->id]['tier_ranks']['desk']);
    expect($scores[0]['bid_line_id'])->toBe($pmLine->id);
});

test('weighted mode sorts by total score before desk tier groups', function () {
    $cmp = ScenarioScoreService::compareScoredLines(
        [
            'total' => 100,
            'tier_ranks' => ['desk' => 3],
            'parts' => ['holiday' => 100, 'personal' => 0, 'desk' => 0],
            'start_time_tiebreak_key' => '22',
            'line_num' => '200',
        ],
        [
            'total' => 50,
            'tier_ranks' => ['desk' => 2],
            'parts' => ['holiday' => 50, 'personal' => 0, 'desk' => 0],
            'start_time_tiebreak_key' => '15',
            'line_num' => '100',
        ],
        ['desk', 'holiday', 'personal'],
        'weighted',
    );

    expect($cmp)->toBeLessThan(0);
});
