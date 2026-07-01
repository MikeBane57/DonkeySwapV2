<?php

use App\Models\BidScenario;
use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidSimulationEngine;
use App\Services\BidTools\CondensedBidderProfileMapper;

function sampleBidderProfile(array $overrides = []): array
{
    $condensed = app(CondensedBidderProfileMapper::class)->condensedDefaults();

    return array_merge([
        'vacation_bank' => 12,
        'holiday_rank' => $condensed['holiday_rank'],
        'desk_rank' => $condensed['desk_rank'],
        'weights' => [
            'holiday' => 2,
            'personal' => 1,
            'desk' => 1,
            'vacation_penalty' => 1,
            'criteria_order' => ['holiday', 'personal', 'desk'],
            'start_time_tiebreak_order' => ['6', '7', '14', '15', '22'],
        ],
        'personal_dates' => [],
        'vacation_ranges' => [],
    ], $overrides);
}

test('user can add bidder with inline profile and run simulation', function () {
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

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Test bid',
    ]);

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.participants.store', $simulation->id), [
            'display_name' => 'Senior Person',
            'seniority_rank' => 1,
            'profile' => sampleBidderProfile(['weights' => [
                'holiday' => 3,
                'personal' => 1,
                'desk' => 1,
                'vacation_penalty' => 1,
                'criteria_order' => ['holiday', 'personal', 'desk'],
            ]]),
        ])
        ->assertRedirect(route('bid-tools.simulations.edit', $simulation->id));

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.participants.store', $simulation->id), [
            'display_name' => 'Junior Person',
            'seniority_rank' => 2,
            'profile' => sampleBidderProfile(['weights' => [
                'holiday' => 1,
                'personal' => 1,
                'desk' => 3,
                'vacation_penalty' => 1,
                'criteria_order' => ['desk', 'holiday', 'personal'],
            ]]),
        ])
        ->assertRedirect(route('bid-tools.simulations.edit', $simulation->id));

    expect(BidSimulationParticipant::where('bid_simulation_id', $simulation->id)->count())->toBe(2);
    expect(BidScenario::where('user_id', $user->id)->count())->toBe(2);

    $this->actingAs($user)
        ->get(route('bid-tools.simulations.edit', $simulation->id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/simulations/edit')
            ->has('participants', 2)
            ->has('participants.0.profile')
            ->missing('scenarios'));

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

test('user can update bidder profile inline', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 3);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Update import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Update test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $participant = BidSimulationParticipant::first();
    $scenario = BidScenario::first();

    $this->actingAs($user)->put(
        route('bid-tools.simulations.participants.update', [$simulation->id, $participant->id]),
        [
            'display_name' => 'Alice Updated',
            'seniority_rank' => 2,
            'profile' => sampleBidderProfile(['vacation_bank' => 8]),
        ],
    )->assertRedirect(route('bid-tools.simulations.edit', $simulation->id));

    $participant->refresh();
    $scenario->refresh();

    expect($participant->display_name)->toBe('Alice Updated');
    expect($participant->seniority_rank)->toBe(2);
    expect($scenario->vacation_bank)->toBe(8);
    expect($scenario->name)->toBe('Alice Updated · Update test');
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

test('removing bidder deletes unused scenario profile', function () {
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
        'Del import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Delete test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Bob',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $participant = BidSimulationParticipant::first();
    $scenarioId = $participant->bid_scenario_id;

    $this->actingAs($user)->delete(
        route('bid-tools.simulations.participants.destroy', [$simulation->id, $participant->id]),
    );

    expect(BidSimulationParticipant::count())->toBe(0);
    expect(BidScenario::whereKey($scenarioId)->exists())->toBeFalse();
});

test('user can delete simulation and linked bidder profiles', function () {
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
        'Sim delete import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Gone soon',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $scenarioId = BidSimulationParticipant::first()->bid_scenario_id;

    $this->actingAs($user)
        ->delete(route('bid-tools.simulations.destroy', $simulation->id))
        ->assertRedirect(route('bid-tools.simulations.index'));

    expect(BidSimulation::count())->toBe(0);
    expect(BidSimulationParticipant::count())->toBe(0);
    expect(BidScenario::whereKey($scenarioId)->exists())->toBeFalse();
});
