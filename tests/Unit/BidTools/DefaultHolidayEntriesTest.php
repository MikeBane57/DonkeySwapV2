<?php

use App\Services\BidTools\FederalHolidayCalendar;
use App\Services\BidTools\ScenarioScoreService;

test('default holiday entries rank christmas thanksgiving july 4 and super bowl first', function () {
    $entries = app(ScenarioScoreService::class)->defaultHolidayEntries(2026);
    $byId = collect($entries)->keyBy('id');

    expect($byId['christmas_eve']['priority'])->toBe('high');
    expect($byId['thanksgiving']['priority'])->toBe('high');
    expect($byId['black_friday']['priority'])->toBe('high');
    expect($byId['july_4']['priority'])->toBe('high');
    expect($byId['super_bowl_sunday']['priority'])->toBe('high');
    expect($byId['new_years_day']['priority'])->toBe('ignore');
    expect($byId['easter']['priority'])->toBe('ignore');

    $rankedIds = collect($entries)
        ->filter(fn (array $row) => $row['priority'] === 'high')
        ->pluck('id')
        ->all();

    expect($rankedIds)->toBe(FederalHolidayCalendar::DEFAULT_RANKED_HOLIDAY_IDS);
});
