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
