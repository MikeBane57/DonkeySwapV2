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
            'start_time' => 2,
            'desk' => 1,
            'vacation_penalty' => 1,
            'criteria_order' => ['start_time', 'holiday', 'personal', 'desk'],
        ],
        'holiday_rank' => [['key' => 'christmas', 'priority' => 'high']],
        'desk_rank' => [['key' => 'XG', 'priority' => 'high']],
        'start_time_rank' => [['key' => '6', 'priority' => 'high']],
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
    expect($copy->weights['criteria_order'])->toBe(['start_time', 'holiday', 'personal', 'desk']);
    expect($copy->personal_dates)->toHaveCount(1);
    expect($copy->vacationRanges)->toHaveCount(1);
    expect($copy->vacationRanges->first()->title)->toBe('Summer');
});
