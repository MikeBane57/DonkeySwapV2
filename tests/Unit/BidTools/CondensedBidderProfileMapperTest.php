<?php

use App\Services\BidTools\CondensedBidderProfileMapper;
use App\Services\BidTools\CondensedDeskClassifier;
use App\Services\BidTools\FederalHolidayCalendar;

function mapper(): CondensedBidderProfileMapper
{
    return new CondensedBidderProfileMapper(new FederalHolidayCalendar);
}

test('condensed defaults include holiday and desk ranks', function () {
    $defaults = mapper()->condensedDefaults();

    expect($defaults['holiday_rank'])->toHaveCount(5);
    expect(collect($defaults['holiday_rank'])->pluck('key')->all())->toBe([
        'christmas',
        'thanksgiving',
        'july_4',
        'super_bowl',
        'new_years',
    ]);
    expect(collect($defaults['holiday_rank'])->pluck('priority', 'key')->all())->toBe([
        'christmas' => 'high',
        'thanksgiving' => 'high',
        'july_4' => 'high',
        'super_bowl' => 'high',
        'new_years' => 'ignore',
    ]);

    expect($defaults['desk_rank'])->toHaveCount(count(CondensedDeskClassifier::BUCKETS));
    expect(collect($defaults['desk_rank'])->pluck('key')->all())->toBe(CondensedDeskClassifier::BUCKETS);
});

test('expand holiday rank defaults prioritize christmas thanksgiving july 4 and super bowl', function () {
    $mapper = mapper();
    $expanded = $mapper->expandHolidayRank($mapper->defaultHolidayRank(), 2026);
    $byId = collect($expanded)->keyBy('id');

    expect($byId['christmas_eve']['priority'])->toBe('high');
    expect($byId['thanksgiving']['priority'])->toBe('high');
    expect($byId['black_friday']['priority'])->toBe('high');
    expect($byId['july_4']['priority'])->toBe('high');
    expect($byId['super_bowl_sunday']['priority'])->toBe('high');
    expect($byId['new_years_day']['priority'])->toBe('ignore');
    expect($byId['easter']['priority'])->toBe('ignore');

    $rankedIds = collect($expanded)
        ->filter(fn (array $row) => $row['priority'] === 'high')
        ->pluck('id')
        ->all();

    expect($rankedIds)->toBe([
        'christmas_eve',
        'christmas_day',
        'thanksgiving',
        'black_friday',
        'july_4',
        'super_bowl_sunday',
    ]);
});

test('expand holiday rank applies same priority to eve and day', function () {
    $mapper = mapper();

    $expanded = $mapper->expandHolidayRank([
        ['key' => 'christmas', 'priority' => 'low'],
        ['key' => 'thanksgiving', 'priority' => 'high'],
        ['key' => 'new_years', 'priority' => 'ignore'],
        ['key' => 'july_4', 'priority' => 'high'],
    ], 2026);

    $christmas = collect($expanded)->whereIn('id', ['christmas_eve', 'christmas_day']);
    expect($christmas)->toHaveCount(2);
    expect($christmas->pluck('priority')->unique()->all())->toBe(['low']);

    $thanksgiving = collect($expanded)->whereIn('id', ['thanksgiving', 'black_friday']);
    expect($thanksgiving->pluck('priority')->unique()->all())->toBe(['high']);
});

test('expand desk rank keeps user bucket tiers and merges import buckets', function () {
    $mapper = mapper();

    $expanded = $mapper->expandDeskRank([
        ['key' => 'DG', 'priority' => 'high'],
        ['key' => 'DR', 'priority' => 'low'],
        ['key' => 'DS7', 'priority' => 'high'],
        ['key' => 'MID', 'priority' => 'ignore'],
        ['key' => 'RELIEF', 'priority' => 'high'],
    ], ['DG', 'DR', 'DS7']);

    $byKey = collect($expanded)->keyBy('key');

    expect($byKey->keys()->all())->toContain('DG', 'DR', 'DS7', 'MID', 'RELIEF');
    expect($byKey['DR']['priority'])->toBe('low');
    expect($byKey['DS7']['priority'])->toBe('high');
});

test('to condensed desk rank preserves stored bucket priorities', function () {
    $mapper = mapper();

    $condensed = $mapper->toCondensedDeskRank([
        ['key' => 'DG', 'priority' => 'high'],
        ['key' => 'DR', 'priority' => 'low'],
        ['key' => 'DS7', 'priority' => 'ignore'],
    ]);

    $byKey = collect($condensed)->keyBy('key');

    expect($byKey['DR']['priority'])->toBe('low');
    expect($byKey['DS7']['priority'])->toBe('ignore');
});

test('to condensed desk rank preserves stored list order', function () {
    $mapper = mapper();

    $condensed = $mapper->toCondensedDeskRank([
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 3],
        ['key' => 'DS_DR_MIX', 'priority' => 'high', 'tier' => 4],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 5],
    ]);

    expect(collect($condensed)->take(5)->pluck('key')->all())->toBe([
        'DS',
        'DR',
        'DS7',
        'DS_DR_MIX',
        'DG',
    ]);
});
