<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\ScenarioScoreService;

test('sort explanation includes ranked holidays and personal date matches per line', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMinimalBidCsv($bidYear, '1', 'DG');

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'preference-matches.csv',
        $user->id,
        $bidYear,
        null,
        'Preference match import',
    )['import'];

    @unlink($path);

    $line = BidLine::query()->where('bid_import_id', $import->id)->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Preference match test',
        'vacation_bank' => 10,
        'holiday_rank' => [
            ['date' => '2026-12-25', 'label' => 'Christmas', 'priority' => 'high'],
        ],
        'personal_dates' => [
            ['date' => '2026-07-04', 'label' => 'July 4 off', 'priority' => 'high'],
            [
                'starts_on' => '2026-03-10',
                'ends_on' => '2026-03-12',
                'label' => 'Spring break',
                'priority' => 'high',
            ],
        ],
    ]);

    $scoreService = app(ScenarioScoreService::class);
    $scores = $scoreService->scoreLines($scenario, [$line->id]);
    $explanation = $scoreService->buildSortExplanation($scenario, $scores);

    expect($explanation['preference_entries']['holidays'])->toHaveCount(1);
    expect($explanation['preference_entries']['personal'])->toHaveCount(2);
    expect($explanation['line_details'][0])->toHaveKeys([
        'holiday_matches',
        'personal_matches',
        'key_holidays',
        'holidays_off',
    ]);

    expect($explanation['line_details'][0]['holiday_matches'][0]['label'])->toBe('Christmas');
    expect($explanation['line_details'][0]['holiday_matches'][0]['off'])->toBeTrue();
    expect($explanation['line_details'][0]['personal_matches'])->toHaveCount(2);
    expect($explanation['line_details'][0]['personal_matches'][0]['all_off'])->toBeTrue();
    expect($explanation['line_details'][0]['personal_matches'][1]['kind'])->toBe('range');
    expect($explanation['line_details'][0]['personal_matches'][1]['total_days'])->toBe(3);
    expect($explanation['line_details'][0]['personal_matches'][1]['all_off'])->toBeTrue();
});
