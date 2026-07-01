<?php

use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;

test('user can duplicate a scenario with preferences and vacation ranges', function () {
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
        'Dup import',
    )['import'];

    @unlink($path);

    $source = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'My prefs',
        'vacation_bank' => 9,
        'weights' => [
            'holiday' => 3,
            'personal' => 1,
            'desk' => 2,
            'vacation_penalty' => 1,
            'criteria_order' => ['desk', 'holiday', 'personal'],
            'start_time_tiebreak_order' => ['7', '6', '14', '15', '22'],
        ],
        'holiday_rank' => [['key' => 'christmas', 'priority' => 'high']],
        'desk_rank' => [['key' => 'DS7', 'priority' => 'high']],
        'start_time_rank' => [],
        'personal_dates' => [['date' => '2026-07-04', 'label' => 'July 4', 'priority' => 'high']],
    ]);

    $source->vacationRanges()->create([
        'title' => 'Summer',
        'starts_on' => '2026-07-01',
        'ends_on' => '2026-07-10',
    ]);

    $this->actingAs($user)
        ->post(route('bid-tools.scenarios.duplicate', $source->id))
        ->assertRedirect();

    expect(BidScenario::where('user_id', $user->id)->count())->toBe(2);

    $copy = BidScenario::query()
        ->where('user_id', $user->id)
        ->whereKeyNot($source->id)
        ->with('vacationRanges')
        ->first();

    expect($copy)->not->toBeNull();
    expect($copy->name)->toBe('My prefs (copy)');
    expect($copy->vacation_bank)->toBe(9);
    expect((float) $copy->weights['holiday'])->toBe(3.0);
    expect($copy->weights['criteria_order'])->toBe(['desk', 'holiday', 'personal']);
    expect($copy->personal_dates)->toHaveCount(1);
    expect($copy->vacationRanges)->toHaveCount(1);
    expect($copy->vacationRanges->first()->title)->toBe('Summer');
});
