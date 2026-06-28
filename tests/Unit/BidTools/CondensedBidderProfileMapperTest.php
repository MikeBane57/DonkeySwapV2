<?php

use App\Services\BidTools\CondensedBidderProfileMapper;
use App\Services\BidTools\FederalHolidayCalendar;

function mapper(): CondensedBidderProfileMapper
{
    return new CondensedBidderProfileMapper(new FederalHolidayCalendar);
}

test('condensed defaults include holiday desk and start time ranks', function () {
    $defaults = mapper()->condensedDefaults();

    expect($defaults['holiday_rank'])->toHaveCount(4);
    expect(collect($defaults['holiday_rank'])->pluck('key')->all())->toBe([
        'christmas',
        'thanksgiving',
        'new_years',
        'july_4',
    ]);

    expect($defaults['desk_rank'])->toHaveCount(5);
    expect(collect($defaults['desk_rank'])->pluck('key')->all())->toBe([
        'XG',
        'XR',
        'XS',
        'MID',
        'RELIEF',
    ]);

    expect($defaults['start_time_rank'])->toHaveCount(5);
    expect(collect($defaults['start_time_rank'])->pluck('key')->all())->toBe([
        '6',
        '7',
        '14',
        '15',
        '22',
    ]);
    expect(collect($defaults['start_time_rank'])->pluck('tier')->all())->toBe([
        1,
        1,
        2,
        2,
        3,
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
        ['key' => 'XG', 'priority' => 'high'],
        ['key' => 'XR', 'priority' => 'low'],
        ['key' => 'XS', 'priority' => 'high'],
        ['key' => 'MID', 'priority' => 'ignore'],
        ['key' => 'RELIEF', 'priority' => 'high'],
    ], ['XG', 'XR', 'XS']);

    $byKey = collect($expanded)->keyBy('key');

    expect($byKey->keys()->all())->toBe(['XG', 'XR', 'XS']);
    expect($byKey['XR']['priority'])->toBe('low');
});

test('expand start time rank maps hour keys to import start keys', function () {
    $mapper = mapper();

    $expanded = $mapper->expandStartTimeRank([
        ['key' => '6', 'priority' => 'high', 'tier' => 1],
        ['key' => '7', 'priority' => 'high', 'tier' => 1],
        ['key' => '14', 'priority' => 'ignore', 'tier' => 2],
        ['key' => '15', 'priority' => 'high', 'tier' => 2],
        ['key' => '22', 'priority' => 'low', 'tier' => 3],
    ], ['t_0600', 't_0700', 't_1400']);

    $byKey = collect($expanded)->keyBy('key');

    expect($byKey['t_0600']['priority'])->toBe('high');
    expect($byKey['t_0700']['priority'])->toBe('high');
    expect($byKey['t_0600']['tier'])->toBe(1);
    expect($byKey['t_0700']['tier'])->toBe(1);
    expect($byKey['t_1400']['priority'])->toBe('ignore');
    expect($byKey['t_1400']['tier'])->toBe(2);
});

test('to condensed desk rank preserves stored bucket priorities', function () {
    $mapper = mapper();

    $condensed = $mapper->toCondensedDeskRank([
        ['key' => 'XG', 'priority' => 'high'],
        ['key' => 'XR', 'priority' => 'low'],
        ['key' => 'XS', 'priority' => 'ignore'],
    ]);

    $byKey = collect($condensed)->keyBy('key');

    expect($byKey['XR']['priority'])->toBe('low');
    expect($byKey['XS']['priority'])->toBe('ignore');
});
