<?php

use App\Models\BidScenario;
use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidSimulationEngine;
use App\Services\BidTools\CondensedBidderProfileMapper;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Support\Facades\DB;

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

    BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Saved template A',
        'vacation_bank' => 12,
    ]);
    BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Saved template B',
        'vacation_bank' => 12,
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
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

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
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    expect(BidSimulationParticipant::where('bid_simulation_id', $simulation->id)->count())->toBe(2);
    expect(BidScenario::where('user_id', $user->id)->count())->toBe(4);

    $this->actingAs($user)
        ->get(route('bid-tools.simulations.show', $simulation->id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/simulations/show')
            ->has('participants', 2)
            ->has('participants.0.profile')
            ->has('profile_templates', 2)
            ->has('desk_catalog')
            ->has('lines'));

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.run', $simulation->id))
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    $simulation->refresh();
    expect($simulation->last_run_results)->toHaveCount(2);
    expect($simulation->last_run_results[0]['display_name'])->toBe('Senior Person');
    expect($simulation->last_run_results[0]['bid_line_id'])->not->toBeNull();

    $seniorLineId = $simulation->last_run_results[0]['bid_line_id'];
    $juniorLineId = $simulation->last_run_results[1]['bid_line_id'];
    expect($simulation->last_run_results[0]['bid_line_id'])->not->toBe($juniorLineId);
});

test('simulation run completes with many participants', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 55);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Large sim import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Large simulation',
    ]);

    for ($rank = 1; $rank <= 54; $rank++) {
        $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
            'display_name' => "Bidder {$rank}",
            'seniority_rank' => $rank,
            'profile' => sampleBidderProfile([
                'weights' => [
                    'holiday' => 1 + ($rank % 3),
                    'personal' => 1,
                    'desk' => 1,
                    'vacation_penalty' => 1,
                    'sort_mode' => 'blended',
                    'criteria_order' => ['holiday', 'personal', 'desk'],
                ],
            ]),
        ]);
    }

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.run', $simulation->id))
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    $simulation->refresh();

    expect($simulation->last_run_results)->toHaveCount(54);
    expect(collect($simulation->last_run_results)->pluck('bid_line_id')->filter()->unique())->toHaveCount(54);
});

test('simulation run does not reload bid line days for every participant scenario', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMultiLineBidCsv($bidYear, 55);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Query count import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Query count simulation',
    ]);

    for ($rank = 1; $rank <= 12; $rank++) {
        $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
            'display_name' => "Bidder {$rank}",
            'seniority_rank' => $rank,
            'profile' => sampleBidderProfile([
                'weights' => [
                    'holiday' => $rank,
                    'personal' => 1,
                    'desk' => 1,
                    'vacation_penalty' => 1,
                    'criteria_order' => ['holiday', 'personal', 'desk'],
                ],
            ]),
        ]);
    }

    $simulation->load(['participants.scenario.import', 'import']);

    DB::enableQueryLog();

    app(BidSimulationEngine::class)->run($simulation);

    $dayQueries = collect(DB::getQueryLog())
        ->filter(fn (array $query): bool => str_contains($query['query'], 'bid_line_days'))
        ->count();

    expect($dayQueries)->toBeLessThanOrEqual(2);
});

test('user can add bidder from saved profile template with custom identity fields', function () {
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
        'Template import',
    )['import'];

    @unlink($path);

    $templateProfile = sampleBidderProfile([
        'vacation_bank' => 15,
        'weights' => [
            'holiday' => 5,
            'personal' => 2,
            'desk' => 1,
            'vacation_penalty' => 1,
            'criteria_order' => ['holiday', 'desk', 'personal'],
        ],
    ]);

    $templateScenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Saved prefs',
        'vacation_bank' => $templateProfile['vacation_bank'],
        'weights' => $templateProfile['weights'],
        'holiday_rank' => $templateProfile['holiday_rank'],
        'desk_rank' => $templateProfile['desk_rank'],
        'personal_dates' => $templateProfile['personal_dates'],
    ]);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Template test',
    ]);

    $this->actingAs($user)
        ->get(route('bid-tools.simulations.show', $simulation->id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/simulations/show')
            ->has('profile_templates', 1)
            ->where('profile_templates.0.id', $templateScenario->id)
            ->where('profile_templates.0.name', 'Saved prefs'));

    $copiedProfile = array_merge($templateProfile, [
        'vacation_bank' => 7,
    ]);

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.participants.store', $simulation->id), [
            'display_name' => 'From template',
            'seniority_rank' => 1,
            'profile' => $copiedProfile,
        ])
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    $participant = BidSimulationParticipant::first();
    $scenario = BidScenario::whereKey($participant->bid_scenario_id)->first();

    expect($participant->display_name)->toBe('From template');
    expect($participant->seniority_rank)->toBe(1);
    expect($scenario->vacation_bank)->toBe(7);
    expect($scenario->weights['holiday'])->toBe(5);
    expect($scenario->weights['criteria_order'])->toBe(['holiday', 'desk', 'personal']);
    expect($scenario->id)->not->toBe($templateScenario->id);
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
            'seniority_rank' => 1,
            'profile' => sampleBidderProfile(['vacation_bank' => 8]),
        ],
    )->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    $participant->refresh();
    $scenario->refresh();

    expect($participant->display_name)->toBe('Alice Updated');
    expect($participant->seniority_rank)->toBe(1);
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
            ->has('rows', 4)
            ->has('rows.0.key_holidays')
            ->has('rows.0.schedule_callouts')
            ->has('sort_explanation'));

    $this->actingAs($user)
        ->getJson(route('bid-tools.simulations.participants.recommendations', [
            $simulation->id,
            $participant->id,
        ]))
        ->assertOk()
        ->assertJsonPath('minimum_depth', 3)
        ->assertJsonCount(4, 'rows')
        ->assertJsonStructure([
            'minimum_depth',
            'rows',
            'computed_rows',
            'order_source',
            'manual_line_order',
            'sort_explanation' => [
                'sort_mode',
                'sort_mode_label',
                'summary',
                'steps',
            ],
        ]);
});

test('participant manual line order overrides computed recommendations and simulation run', function () {
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
        'Manual order import',
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
        'name' => 'Manual order test',
    ]);

    $participant = BidSimulationParticipant::create([
        'bid_simulation_id' => $simulation->id,
        'seniority_rank' => 1,
        'display_name' => 'Rank 1',
        'bid_scenario_id' => $scenario->id,
    ]);

    $computed = app(BidSimulationEngine::class)->recommendForParticipant($participant, $simulation);
    expect($computed)->toHaveCount(4);

    $manualOrder = array_reverse(array_map(fn (array $row) => $row['bid_line_id'], $computed));

    $this->actingAs($user)
        ->putJson(route('bid-tools.simulations.participants.line-order', [
            $simulation->id,
            $participant->id,
        ]), [
            'line_order' => $manualOrder,
        ])
        ->assertOk()
        ->assertJsonPath('order_source', 'manual')
        ->assertJsonPath('rows.0.bid_line_id', $manualOrder[0]);

    $results = app(BidSimulationEngine::class)->run($simulation->fresh()->load(['participants.scenario.import', 'import']));
    expect($results[0]['bid_line_id'])->toBe($manualOrder[0]);

    $this->actingAs($user)
        ->putJson(route('bid-tools.simulations.participants.line-order', [
            $simulation->id,
            $participant->id,
        ]), [
            'line_order' => null,
        ])
        ->assertOk()
        ->assertJsonPath('order_source', 'computed')
        ->assertJsonPath('rows.0.bid_line_id', $computed[0]['bid_line_id']);
});

test('updating bidder preferences clears manual line order', function () {
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
        'Clear manual import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Clear manual test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $participant = BidSimulationParticipant::query()
        ->where('bid_simulation_id', $simulation->id)
        ->first();

    $lineIds = \App\Models\BidLine::query()
        ->where('bid_import_id', $import->id)
        ->orderByDesc('id')
        ->pluck('id')
        ->all();

    $participant->scenario->update(['manual_line_order' => $lineIds]);

    $this->actingAs($user)->put(route('bid-tools.simulations.participants.update', [
        $simulation->id,
        $participant->id,
    ]), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'skips_bid' => false,
        'profile' => sampleBidderProfile(['vacation_bank' => 9]),
    ])->assertRedirect();

    expect($participant->scenario->fresh()->manual_line_order)->toBeNull();
});

test('adding a bidder at an occupied slot shifts lower bidders down', function () {
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
        'Insert slot import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Insert slot test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Bob',
        'seniority_rank' => 2,
        'profile' => sampleBidderProfile(),
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Charlie',
        'seniority_rank' => 2,
        'profile' => sampleBidderProfile(),
    ])->assertRedirect();

    $participants = BidSimulationParticipant::query()
        ->where('bid_simulation_id', $simulation->id)
        ->orderBy('seniority_rank')
        ->get();

    expect($participants)->toHaveCount(3);
    expect($participants->pluck('display_name', 'seniority_rank')->all())->toBe([
        1 => 'Alice',
        2 => 'Charlie',
        3 => 'Bob',
    ]);
});

test('updating bidder pick order repositions other bidders', function () {
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
        'Reposition import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Reposition test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Bob',
        'seniority_rank' => 2,
        'profile' => sampleBidderProfile(),
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Carol',
        'seniority_rank' => 3,
        'profile' => sampleBidderProfile(),
    ]);

    $carol = BidSimulationParticipant::query()
        ->where('bid_simulation_id', $simulation->id)
        ->where('display_name', 'Carol')
        ->first();

    $this->actingAs($user)->put(route('bid-tools.simulations.participants.update', [
        $simulation->id,
        $carol->id,
    ]), [
        'display_name' => 'Carol',
        'seniority_rank' => 1,
        'skips_bid' => false,
        'profile' => sampleBidderProfile(),
    ])->assertRedirect();

    $participants = BidSimulationParticipant::query()
        ->where('bid_simulation_id', $simulation->id)
        ->orderBy('seniority_rank')
        ->get();

    expect($participants->pluck('display_name', 'seniority_rank')->all())->toBe([
        1 => 'Carol',
        2 => 'Alice',
        3 => 'Bob',
    ]);
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

test('user can duplicate a simulation with bidders and preferences', function () {
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
        'Dup sim import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Original sim',
        'last_run_at' => now(),
        'last_run_results' => [['participant_id' => 1]],
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(['vacation_bank' => 11]),
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Bob',
        'seniority_rank' => 2,
        'skips_bid' => true,
        'profile' => sampleBidderProfile(),
    ]);

    $sourceScenarioIds = BidSimulationParticipant::query()
        ->where('bid_simulation_id', $simulation->id)
        ->pluck('bid_scenario_id')
        ->all();

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.duplicate', $simulation->id))
        ->assertRedirect();

    expect(BidSimulation::where('user_id', $user->id)->count())->toBe(2);

    $copy = BidSimulation::query()
        ->where('user_id', $user->id)
        ->whereKeyNot($simulation->id)
        ->first();

    expect($copy)->not->toBeNull();
    expect($copy->name)->toBe('Original sim (copy)');
    expect($copy->last_run_at)->toBeNull();
    expect($copy->last_run_results)->toBeNull();

    $copyParticipants = BidSimulationParticipant::query()
        ->where('bid_simulation_id', $copy->id)
        ->orderBy('seniority_rank')
        ->get();

    expect($copyParticipants)->toHaveCount(2);
    expect($copyParticipants[0]->display_name)->toBe('Alice');
    expect($copyParticipants[1]->display_name)->toBe('Bob');
    expect($copyParticipants[1]->skips_bid)->toBeTrue();

    $copyScenarioIds = $copyParticipants->pluck('bid_scenario_id')->all();
    expect($copyScenarioIds)->not->toContain($sourceScenarioIds[0]);
    expect($copyScenarioIds)->not->toContain($sourceScenarioIds[1]);

    $aliceScenario = BidScenario::find($copyParticipants[0]->bid_scenario_id);
    expect($aliceScenario->vacation_bank)->toBe(11);
    expect($aliceScenario->name)->toBe('Alice · Original sim (copy)');
});

test('skipped bidder does not take a line during simulation run', function () {
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
        'Skip import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Skip test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Senior',
        'seniority_rank' => 1,
        'skips_bid' => true,
        'profile' => sampleBidderProfile(),
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Junior',
        'seniority_rank' => 2,
        'profile' => sampleBidderProfile(),
    ]);

    $this->actingAs($user)
        ->post(route('bid-tools.simulations.run', $simulation->id))
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    $simulation->refresh();

    expect($simulation->last_run_results)->toHaveCount(2);
    expect($simulation->last_run_results[0]['display_name'])->toBe('Senior');
    expect($simulation->last_run_results[0]['bid_line_id'])->toBeNull();
    expect($simulation->last_run_results[0]['skipped'])->toBeTrue();
    expect($simulation->last_run_results[0]['message'])->toBe('Passed / no bid');
    expect($simulation->last_run_results[1]['display_name'])->toBe('Junior');
    expect($simulation->last_run_results[1]['bid_line_id'])->not->toBeNull();
});

test('simulation edit route redirects to unified show page', function () {
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
        'Redirect import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Redirect test',
    ]);

    $this->actingAs($user)
        ->get(route('bid-tools.simulations.edit', $simulation->id))
        ->assertRedirect(route('bid-tools.simulations.show', $simulation->id));
});

test('user can save simulation-level import file mapping', function () {
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
        'Mapping import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Mapping test',
    ]);

    $this->actingAs($user)->put(route('bid-tools.simulations.update', $simulation->id), [
        'name' => 'Mapping test',
        'desk_bucket_mappings' => [
            ['desk_group' => 'DS', 'start_time' => '06:00', 'bucket' => 'DS7'],
        ],
        'line_desk_buckets' => [],
    ])->assertRedirect(route('bid-tools.simulations.show', $simulation->id));

    $simulation->refresh();

    expect($simulation->desk_bucket_mappings)->toHaveCount(1);
    expect($simulation->desk_bucket_mappings[0]['bucket'])->toBe('DS7');
});

test('saving simulation mapping clears stale per-bidder scenario mappings', function () {
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
        'Clear mapping import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Clear mapping test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $scenario = BidScenario::first();
    $scenario->update([
        'desk_bucket_mappings' => [
            ['desk_group' => 'DS', 'start_time' => '06:00', 'bucket' => 'DG'],
        ],
        'line_desk_buckets' => [
            ['bid_line_id' => 1, 'bucket' => 'AS'],
        ],
    ]);

    $this->actingAs($user)->put(route('bid-tools.simulations.update', $simulation->id), [
        'name' => 'Clear mapping test',
        'desk_bucket_mappings' => [
            ['desk_group' => 'DS', 'start_time' => '06:00', 'bucket' => 'DS7'],
        ],
        'line_desk_buckets' => [],
    ]);

    $scenario->refresh();

    expect($scenario->desk_bucket_mappings)->toBe([]);
    expect($scenario->line_desk_buckets)->toBe([]);
});

test('updating bidder profile does not persist import line mappings on scenario', function () {
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
        'Bidder save import',
    )['import'];

    @unlink($path);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Bidder save test',
    ]);

    $this->actingAs($user)->post(route('bid-tools.simulations.participants.store', $simulation->id), [
        'display_name' => 'Alice',
        'seniority_rank' => 1,
        'profile' => sampleBidderProfile(),
    ]);

    $participant = BidSimulationParticipant::first();
    $scenario = BidScenario::first();
    $scenario->update([
        'desk_bucket_mappings' => [
            ['desk_group' => 'DS', 'start_time' => '06:00', 'bucket' => 'DG'],
        ],
    ]);

    $this->actingAs($user)->put(
        route('bid-tools.simulations.participants.update', [$simulation->id, $participant->id]),
        [
            'display_name' => 'Alice Updated',
            'seniority_rank' => 1,
            'profile' => sampleBidderProfile(['vacation_bank' => 9]),
        ],
    );

    $scenario->refresh();

    expect($scenario->desk_bucket_mappings)->toBe([]);
    expect($scenario->line_desk_buckets)->toBe([]);
    expect($scenario->vacation_bank)->toBe(9);
});

test('simulation recommendations use simulation import mapping not stale bidder scenario mapping', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeMinimalBidCsv($bidYear, '1', 'DS');

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $user->id,
        $bidYear,
        null,
        'Mapping score import',
    )['import'];

    @unlink($path);

    $line = \App\Models\BidLine::query()
        ->where('bid_import_id', $import->id)
        ->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Bidder prefs',
        'vacation_bank' => 10,
        'desk_bucket_mappings' => [],
        'line_desk_buckets' => [
            ['bid_line_id' => $line->id, 'bucket' => 'DG'],
        ],
    ]);

    $simulation = BidSimulation::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Mapping score test',
        'desk_bucket_mappings' => [],
        'line_desk_buckets' => [
            ['bid_line_id' => $line->id, 'bucket' => 'DS7'],
        ],
    ]);

    $participant = BidSimulationParticipant::create([
        'bid_simulation_id' => $simulation->id,
        'seniority_rank' => 1,
        'display_name' => 'Alice',
        'bid_scenario_id' => $scenario->id,
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$line->id],
        deskBucketMappingsOverride: $simulation->desk_bucket_mappings,
        lineDeskBucketsOverride: $simulation->line_desk_buckets,
        ignoreScenarioImportMapping: true,
    );

    expect($scores[0]['breakdown']['group_bucket'])->toBe('DS7');

    $this->actingAs($user)
        ->getJson(route('bid-tools.simulations.participants.recommendations', [
            $simulation->id,
            $participant->id,
        ]))
        ->assertOk();

    $scenario->refresh();
    expect($scenario->desk_bucket_mappings)->toBe([]);
    expect($scenario->line_desk_buckets)->toBe([]);
});
