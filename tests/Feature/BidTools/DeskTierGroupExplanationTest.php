<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\ScenarioScoreService;

test('sort explanation desk tier groups follow editor list order not catalog order', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 2);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'desk-tier-order.csv',
        $user->id,
        $bidYear,
        null,
        'Desk tier order import',
    )['import'];

    @unlink($path);

    $line = BidLine::query()->where('bid_import_id', $import->id)->firstOrFail();

    $deskRank = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 3],
        ['key' => 'DS_DR_MIX', 'priority' => 'high', 'tier' => 4],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 5],
        ['key' => 'AS', 'priority' => 'high', 'tier' => 6],
        ['key' => 'AS15', 'priority' => 'high', 'tier' => 7],
        ['key' => 'AR', 'priority' => 'high', 'tier' => 8],
        ['key' => 'AS_AR_MIX', 'priority' => 'high', 'tier' => 9],
        ['key' => 'AG', 'priority' => 'high', 'tier' => 10],
        ['key' => 'RELIEF', 'priority' => 'high', 'tier' => 11],
        ['key' => 'MID', 'priority' => 'high', 'tier' => 12],
    ];

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Custom desk tier order',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 0,
            'personal' => 0,
            'desk' => 0,
            'vacation_penalty' => 0,
            'sort_mode' => 'group_ranked',
            'criteria_order' => ['desk', 'holiday', 'personal'],
        ],
        'holiday_rank' => [],
        'desk_rank' => $deskRank,
        'personal_dates' => [],
    ]);

    $scoreService = app(ScenarioScoreService::class);
    $scores = $scoreService->scoreLines($scenario, [$line->id]);
    $explanation = $scoreService->buildSortExplanation($scenario, $scores);

    expect(collect($explanation['desk_tier_groups'])->pluck('label')->all())->toBe([
        'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12',
    ]);
    expect($explanation['desk_tier_groups'][1]['buckets'])->toBe(['DR']);
    expect($explanation['desk_tier_groups'][4]['buckets'])->toBe(['DG']);
});
