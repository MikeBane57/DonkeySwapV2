<?php

use App\Services\BidTools\CondensedBidderProfileMapper;
use App\Services\BidTools\FederalHolidayCalendar;

function mapper(): CondensedBidderProfileMapper
{
    return new CondensedBidderProfileMapper(new FederalHolidayCalendar);
}

test('condensed defaults include holiday and desk ranks', function () {
    $defaults = mapper()->condensedDefaults();

    expect($defaults['holiday_rank'])->toHaveCount(4);
    expect(collect($defaults['holiday_rank'])->pluck('key')->all())->toBe([
        'christmas',
        'thanksgiving',
        'new_years',
        'july_4',
    ]);

    expect($defaults['desk_rank'])->toHaveCount(8);
    expect(collect($defaults['desk_rank'])->pluck('key')->all())->toBe([
        'DG7',
        'AG15',
        'DR7',
        'AR15',
        'DS7',
        'AS7',
        'MID',
        'RELIEF',
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

test('expand desk rank keeps only condensed buckets present in import', function () {
    $mapper = mapper();

    $expanded = $mapper->expandDeskRank([
        ['key' => 'DG7', 'priority' => 'high'],
        ['key' => 'DR7', 'priority' => 'low'],
        ['key' => 'DS7', 'priority' => 'high'],
        ['key' => 'MID', 'priority' => 'ignore'],
        ['key' => 'RELIEF', 'priority' => 'high'],
    ], ['DG7', 'DR7', 'DS7']);

    $byKey = collect($expanded)->keyBy('key');

    expect($byKey->keys()->all())->toBe(['DG7', 'DR7', 'DS7']);
    expect($byKey['DR7']['priority'])->toBe('low');
});

test('to condensed desk rank preserves stored bucket priorities', function () {
    $mapper = mapper();

    $condensed = $mapper->toCondensedDeskRank([
        ['key' => 'DG7', 'priority' => 'high'],
        ['key' => 'DR7', 'priority' => 'low'],
        ['key' => 'DS7', 'priority' => 'ignore'],
    ]);

    $byKey = collect($condensed)->keyBy('key');

    expect($byKey['DR7']['priority'])->toBe('low');
    expect($byKey['DS7']['priority'])->toBe('ignore');
});
