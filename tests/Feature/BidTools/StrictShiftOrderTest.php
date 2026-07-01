<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\ScenarioScoreService;

test('start time tiebreak ranks preferred hour when desk tiers match', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeDeskStartTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'tiebreak.csv',
        $user->id,
        $bidYear,
        null,
        'Tiebreak import',
    )['import'];

    @unlink($path);

    $dg0600 = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->where('line_num', '551')
        ->firstOrFail();
    $dg0700 = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->where('line_num', '553')
        ->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Tiebreak test',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 1,
            'vacation_penalty' => 0,
            'sort_mode' => 'weighted',
            'criteria_order' => ['holiday', 'personal', 'desk'],
            'start_time_tiebreak_order' => ['7', '6', '14', '15', '22'],
        ],
        'holiday_rank' => [],
        'desk_rank' => [
            ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$dg0600->id, $dg0700->id],
    );

    expect($scores[0]['bid_line_id'])->toBe($dg0700->id);
    expect($scores[0]['start_time_tiebreak_key'])->toBe('7');
});
