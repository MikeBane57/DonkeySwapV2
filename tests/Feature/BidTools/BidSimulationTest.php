<?php

use App\Models\BidLine;
use App\Models\BidScenario;
use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidSimulationEngine;

test('user can create simulation with participants and run seniority bid', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 5);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Sim import',
    )['import'];

    @unlink($path);

    $scenarioSenior = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Senior prefs',
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

    $scenarioJunior = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Junior prefs',
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

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Test bid',
    ]);

    BidSimulationParticipant::create([
        'bid_simulation_id' => $simulation->id,
        'seniority_rank' => 1,
        'display_name' => 'Senior Person',
        'bid_scenario_id' => $scenarioSenior->id,
    ]);

    BidSimulationParticipant::create([
        'bid_simulation_id' => $simulation->id,
        'seniority_rank' => 2,
        'display_name' => 'Junior Person',
        'bid_scenario_id' => $scenarioJunior->id,
    ]);

    $this->actingAs($user)
        ->get(route('bid-tools.simulations.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/simulations/index')
            ->has('simulations', 1));

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.run', $simulation->id))
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    $simulation->refresh();
    expect($simulation->last_run_results)->toHaveCount(2);
    expect($simulation->last_run_results[0]['display_name'])->toBe('Senior Person');
    expect($simulation->last_run_results[0]['bid_line_id'])->not->toBeNull();

    $seniorLineId = $simulation->last_run_results[0]['bid_line_id'];
    $juniorLineId = $simulation->last_run_results[1]['bid_line_id'];
    expect($seniorLineId)->not->toBe($juniorLineId);
});

test('recommendations mark minimum bid depth by seniority rank', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 4);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Rec import',
    )['import'];

    @unlink($path);

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Prefs',
        'vacation_bank' => 10,
    ]);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Rec test',
    ]);

    $participant = BidSimulationParticipant::create([
        'bid_simulation_id' => $simulation->id,
        'seniority_rank' => 3,
        'display_name' => 'Rank 3',
        'bid_scenario_id' => $scenario->id,
    ]);

    $rows = app(BidSimulationEngine::class)->recommendForParticipant($participant);
    expect($rows)->toHaveCount(4);

    $required = collect($rows)->where('minimum_required', true);
    expect($required)->toHaveCount(3);
    expect($required->pluck('rank')->all())->toBe([1, 2, 3]);

    $this->actingAs($user)
        ->get(route('bid-tools.simulations.participants.recommendations', [
            $simulation->id,
            $participant->id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/simulations/recommendations')
            ->where('minimum_depth', 3)
            ->has('rows', 4));
});

test('participant scenario must match simulation import', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;

    $pathA = writeMultiLineBidCsv($bidYear, 2);
    $importA = app(BidLineCsvImportService::class)->importFromPath(
        $pathA,
        'a.csv',
        $user->id,
        $bidYear,
        null,
        'A',
    )['import'];
    @unlink($pathA);

    $pathB = writeMultiLineBidCsv($bidYear, 2);
    $importB = app(BidLineCsvImportService::class)->importFromPath(
        $pathB,
        'b.csv',
        $user->id,
        $bidYear,
        null,
        'B',
    )['import'];
    @unlink($pathB);

    $scenarioOnB = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $importB->id,
        'name' => 'Wrong import',
        'vacation_bank' => 10,
    ]);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $importA->id,
        'name' => 'Mismatch test',
    ]);

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.participants.store', $simulation->id), [
            'display_name' => 'Test',
            'seniority_rank' => 1,
            'bid_scenario_id' => $scenarioOnB->id,
        ])
        ->assertNotFound();
});
