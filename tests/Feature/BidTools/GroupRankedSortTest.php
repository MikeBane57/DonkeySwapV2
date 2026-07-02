<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\ScenarioScoreService;

test('group ranked mode sorts within desk tier group by desk list order then holidays', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeDeskStartTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'group-desk-order.csv',
        $user->id,
        $bidYear,
        null,
        'Group desk order import',
    )['import'];

    @unlink($path);

    $dgLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '551')->firstOrFail();
    $dsLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '552')->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Group ranked desk order',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 1,
            'vacation_penalty' => 0,
            'sort_mode' => 'group_ranked',
            'criteria_order' => ['desk', 'holiday', 'personal'],
        ],
        'holiday_rank' => [],
        'desk_rank' => [
            ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
            ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$dgLine->id, $dsLine->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$dsLine->id]['tier_ranks']['desk'])->toBe($byId[$dgLine->id]['tier_ranks']['desk']);
    expect($byId[$dsLine->id]['tier_ranks']['desk_order'])
        ->toBeLessThan($byId[$dgLine->id]['tier_ranks']['desk_order']);
    expect($scores[0]['bid_line_id'])->toBe($dsLine->id);
});

test('group ranked mode keeps lower desk tier group before higher regardless of category order', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeStartTimeHolidayTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'group-tier-first.csv',
        $user->id,
        $bidYear,
        null,
        'Group tier import',
    )['import'];

    @unlink($path);

    $amLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '551')->firstOrFail();
    $pmLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '552')->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Group tier partition',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 10,
            'personal' => 0,
            'desk' => 1,
            'vacation_penalty' => 0,
            'sort_mode' => 'group_ranked',
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
    expect($byId[$amLine->id]['tier_ranks']['desk'])
        ->toBeLessThan($byId[$pmLine->id]['tier_ranks']['desk']);
    expect($scores[0]['bid_line_id'])->toBe($amLine->id);
});

test('group ranked mode applies holiday category order within the same desk tier group', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeStartTimeHolidayTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'group-holiday-order.csv',
        $user->id,
        $bidYear,
        null,
        'Group holiday import',
    )['import'];

    @unlink($path);

    $amLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '551')->firstOrFail();
    $pmLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '552')->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Holiday first within group',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 0,
            'vacation_penalty' => 0,
            'sort_mode' => 'group_ranked',
            'criteria_order' => ['holiday', 'desk', 'personal'],
        ],
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => [
            ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
            ['key' => 'AG', 'priority' => 'high', 'tier' => 1],
        ],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$amLine->id, $pmLine->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$pmLine->id]['tier_ranks']['desk'])->toBe($byId[$amLine->id]['tier_ranks']['desk']);
    expect($byId[$pmLine->id]['tier_ranks']['holiday'])
        ->toBeLessThan($byId[$amLine->id]['tier_ranks']['holiday']);
    expect($scores[0]['bid_line_id'])->toBe($pmLine->id);
});

test('group ranked mode uses cumulative holiday sort scores within the same desk tier group', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $scoreService = app(ScenarioScoreService::class);
    $holidays = $scoreService->defaultHolidayEntries($bidYear);
    expect($holidays)->not->toBeEmpty();

    $firstHoliday = $holidays[0]['date'];
    $secondHoliday = $holidays[1]['date'] ?? $holidays[0]['date'];

    $path = writeSameGroupHolidayScoreCsv($bidYear, [
        '551' => [$firstHoliday, $secondHoliday],
        '552' => [$firstHoliday],
    ]);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'group-holiday-score.csv',
        $user->id,
        $bidYear,
        null,
        'Group holiday score import',
    )['import'];

    @unlink($path);

    $moreHolidaysLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '551')->firstOrFail();
    $oneHolidayLine = BidLine::query()->where('bid_import_id', $import->id)->where('line_num', '552')->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Cumulative holiday within group',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 0,
            'vacation_penalty' => 0,
            'sort_mode' => 'group_ranked',
            'criteria_order' => ['holiday', 'desk', 'personal'],
        ],
        'holiday_rank' => $holidays,
        'desk_rank' => [
            ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = $scoreService->scoreLines(
        $scenario,
        [$oneHolidayLine->id, $moreHolidaysLine->id],
    );

    $byId = collect($scores)->keyBy('bid_line_id');

    expect($byId[$moreHolidaysLine->id]['tier_ranks']['desk'])
        ->toBe($byId[$oneHolidayLine->id]['tier_ranks']['desk']);
    expect($byId[$moreHolidaysLine->id]['tier_ranks']['holiday'])
        ->toBe($byId[$oneHolidayLine->id]['tier_ranks']['holiday']);
    expect($byId[$moreHolidaysLine->id]['sort_scores']['holiday'])
        ->toBeGreaterThan($byId[$oneHolidayLine->id]['sort_scores']['holiday']);
    expect($scores[0]['bid_line_id'])->toBe($moreHolidaysLine->id);
});
