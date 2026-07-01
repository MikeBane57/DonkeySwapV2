<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;

test('user can compare multiple scenarios on the same import', function () {
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
            'desk' => 1,
            'vacation_penalty' => 1,
            'criteria_order' => ['holiday', 'personal', 'desk'],
        ],
    ]);

    $scenarioB = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Desk focus B',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 1,
            'personal' => 1,
            'desk' => 3,
            'vacation_penalty' => 1,
            'criteria_order' => ['desk', 'holiday', 'personal'],
        ],
    ]);

    $scenarioC = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Desk focus C',
        'vacation_bank' => 8,
        'weights' => [
            'holiday' => 1,
            'personal' => 1,
            'desk' => 3,
            'vacation_penalty' => 1,
            'criteria_order' => ['desk', 'holiday', 'personal'],
        ],
    ]);

    $lineIds = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->orderBy('line_num')
        ->pluck('id')
        ->all();

    $scenarioIds = [$scenarioA->id, $scenarioB->id, $scenarioC->id];

    $this->actingAs($user)
        ->get(route('bid-tools.scenarios.compare'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/scenarios/compare')
            ->has('scenarios', 3));

    $response = $this->actingAs($user)->post(route('bid-tools.scenarios.compare.run'), [
        'scenario_ids' => $scenarioIds,
        'line_ids' => $lineIds,
    ]);

    $response->assertRedirect(route('bid-tools.scenarios.compare', [
        'scenarios' => implode(',', $scenarioIds),
    ]));

    $stored = session('bid_scenario_compare');
    expect($stored)->toBeArray()
        ->and($stored['scenarios'])->toHaveCount(3)
        ->and($stored['rows'])->toHaveCount(5);

    foreach ($stored['rows'] as $row) {
        expect($row)->toHaveKeys(['bid_line_id', 'line_num', 'line', 'scenarios']);
        expect($row['scenarios'])->toHaveCount(3);

        foreach ($row['scenarios'] as $scenarioRow) {
            expect($scenarioRow)->toHaveKeys(['scenario_id', 'rank', 'total', 'parts']);
        }
    }

    $this->actingAs($user)
        ->get(route('bid-tools.scenarios.compare', [
            'scenarios' => implode(',', $scenarioIds),
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/scenarios/compare')
            ->has('comparison.rows', 5)
            ->has('comparison.scenarios', 3)
            ->where('comparison.scenarios.0.id', $scenarioA->id));
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
            'scenario_ids' => [$scenarioA->id, $scenarioB->id],
            'line_ids' => $lineIds,
        ])
        ->assertRedirect(route('bid-tools.scenarios.compare'))
        ->assertSessionHas('error', 'All selected scenarios must use the same master import.');
});

test('scenario compare requires at least two scenarios', function () {
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
        'Import',
    )['import'];
    @unlink($path);

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Only one',
        'vacation_bank' => 10,
    ]);

    $lineIds = BidLine::query()->where('bid_import_id', $import->id)->pluck('id')->all();

    $this->actingAs($user)
        ->post(route('bid-tools.scenarios.compare.run'), [
            'scenario_ids' => [$scenario->id],
            'line_ids' => $lineIds,
        ])
        ->assertSessionHasErrors('scenario_ids');
});
