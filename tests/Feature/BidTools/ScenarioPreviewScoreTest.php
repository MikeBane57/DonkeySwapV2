<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;

test('preview score returns ranked lines as json', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 10);

    $result = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Test import',
    );
    $import = $result['import'];

    @unlink($path);

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Preview test',
        'vacation_bank' => 10,
    ]);

    $lineIds = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->orderBy('line_num')
        ->limit(5)
        ->pluck('id')
        ->all();

    $response = $this->actingAs($user)->postJson(
        route('api.bid-tools.scenarios.preview-score', $scenario->id),
        ['line_ids' => $lineIds],
    );

    $response->assertOk()
        ->assertJsonStructure([
            'scored_rows' => [
                ['rank', 'bid_line_id', 'line_num', 'total', 'parts', 'line', 'sort_debug'],
            ],
            'sort_explanation' => [
                'sort_mode',
                'sort_mode_label',
                'summary',
                'steps',
                'criteria_order',
                'desk_tier_groups',
                'line_details',
            ],
        ])
        ->assertJsonCount(5, 'scored_rows');
});

test('preview score accepts draft profile changes', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 10);

    $result = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Test import',
    );
    $import = $result['import'];

    @unlink($path);

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Draft preview',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 1,
            'personal' => 1,
            'desk' => 1,
            'vacation_penalty' => 1,
            'sort_mode' => 'weighted',
            'criteria_order' => ['holiday', 'personal', 'desk'],
        ],
    ]);

    $lineIds = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->orderBy('line_num')
        ->limit(3)
        ->pluck('id')
        ->all();

    $baseline = $this->actingAs($user)->postJson(
        route('api.bid-tools.scenarios.preview-score', $scenario->id),
        ['line_ids' => $lineIds],
    )->json('scored_rows');

    $weighted = $this->actingAs($user)->postJson(
        route('api.bid-tools.scenarios.preview-score', $scenario->id),
        [
            'line_ids' => $lineIds,
            'draft' => [
                'weights' => [
                    'holiday' => 10,
                    'personal' => 0,
                    'desk' => 0,
                    'vacation_penalty' => 0,
                    'sort_mode' => 'weighted',
                    'criteria_order' => ['holiday', 'personal', 'desk'],
                ],
            ],
        ],
    )->json('scored_rows');

    expect($baseline)->toHaveCount(3);
    expect($weighted)->toHaveCount(3);
    expect($weighted[0]['total'])->not->toBe($baseline[0]['total']);
});

test('preview score accepts condensed simulation holiday rank draft', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 5);

    $result = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Condensed draft import',
    );
    $import = $result['import'];

    @unlink($path);

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Condensed draft preview',
        'vacation_bank' => 10,
    ]);

    $lineIds = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->orderBy('line_num')
        ->limit(3)
        ->pluck('id')
        ->all();

    $defaults = app(\App\Services\BidTools\CondensedBidderProfileMapper::class)->condensedDefaults();

    $this->actingAs($user)->postJson(
        route('api.bid-tools.scenarios.preview-score', $scenario->id),
        [
            'line_ids' => $lineIds,
            'draft' => [
                'vacation_bank' => 12,
                'holiday_rank' => $defaults['holiday_rank'],
                'desk_rank' => $defaults['desk_rank'],
                'weights' => [
                    'holiday' => 1,
                    'personal' => 1,
                    'desk' => 1,
                    'vacation_penalty' => 1,
                    'sort_mode' => 'blended',
                    'criteria_order' => ['holiday', 'personal', 'desk'],
                ],
            ],
        ],
    )->assertOk()->assertJsonCount(3, 'scored_rows');
});
