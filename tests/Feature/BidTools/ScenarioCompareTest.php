<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;

test('user can compare two scenarios on the same import', function () {
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
        'Compare import',
    );
    $import = $result['import'];

    @unlink($path);

    $scenarioA = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Holiday focus',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 3,
            'personal' => 1,
            'start_time' => 1,
            'desk' => 1,
            'vacation_penalty' => 1,
            'criteria_order' => ['holiday', 'personal', 'start_time', 'desk'],
        ],
    ]);

    $scenarioB = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Start time focus',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 1,
            'personal' => 1,
            'start_time' => 3,
            'desk' => 1,
            'vacation_penalty' => 1,
            'criteria_order' => ['start_time', 'holiday', 'personal', 'desk'],
        ],
    ]);

    $lineIds = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->orderBy('line_num')
        ->pluck('id')
        ->all();

    $this->actingAs($user)
        ->get(route('bid-tools.scenarios.compare'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/scenarios/compare')
            ->has('scenarios', 2));

    $response = $this->actingAs($user)->post(route('bid-tools.scenarios.compare.run'), [
        'scenario_a_id' => $scenarioA->id,
        'scenario_b_id' => $scenarioB->id,
        'line_ids' => $lineIds,
    ]);

    $response->assertRedirect(route('bid-tools.scenarios.compare', [
        'scenario_a' => $scenarioA->id,
        'scenario_b' => $scenarioB->id,
    ]));

    $stored = session('bid_scenario_compare');
    expect($stored)->toBeArray()
        ->and($stored['rows'])->toHaveCount(5);

    foreach ($stored['rows'] as $row) {
        expect($row)->toHaveKeys([
            'bid_line_id',
            'line_num',
            'rank_a',
            'rank_b',
            'rank_delta',
            'total_a',
            'total_b',
            'total_delta',
            'parts_a',
            'parts_b',
        ]);
        expect($row['rank_delta'])->toBe($row['rank_b'] - $row['rank_a']);
        expect($row['total_delta'])->toBe(round($row['total_b'] - $row['total_a'], 2));
    }

    $this->actingAs($user)
        ->get(route('bid-tools.scenarios.compare', [
            'scenario_a' => $scenarioA->id,
            'scenario_b' => $scenarioB->id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/scenarios/compare')
            ->has('comparison.rows', 5)
            ->where('comparison.scenario_a.id', $scenarioA->id)
            ->where('comparison.scenario_b.id', $scenarioB->id));
});

test('scenario compare rejects scenarios on different imports', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;

    $pathA = writeMultiLineBidCsv($bidYear, 3);
    $importA = app(BidLineCsvImportService::class)->importFromPath(
        $pathA,
        'lines-a.csv',
        $user->id,
        $bidYear,
        null,
        'Import A',
    )['import'];
    @unlink($pathA);

    $pathB = writeMultiLineBidCsv($bidYear, 3);
    $importB = app(BidLineCsvImportService::class)->importFromPath(
        $pathB,
        'lines-b.csv',
        $user->id,
        $bidYear,
        null,
        'Import B',
    )['import'];
    @unlink($pathB);

    $scenarioA = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $importA->id,
        'name' => 'On import A',
        'vacation_bank' => 10,
    ]);

    $scenarioB = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $importB->id,
        'name' => 'On import B',
        'vacation_bank' => 10,
    ]);

    $lineIds = BidLine::query()
        ->where('bid_import_id', $importA->id)
        ->pluck('id')
        ->all();

    $this->actingAs($user)
        ->post(route('bid-tools.scenarios.compare.run'), [
            'scenario_a_id' => $scenarioA->id,
            'scenario_b_id' => $scenarioB->id,
            'line_ids' => $lineIds,
        ])
        ->assertRedirect(route('bid-tools.scenarios.compare'))
        ->assertSessionHas('error', 'Both scenarios must use the same master import.');
});
