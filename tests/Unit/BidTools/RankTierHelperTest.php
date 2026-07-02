<?php

use App\Services\BidTools\RankTierHelper;

test('normalize tier order compresses tier numbers by first appearance', function () {
    $entries = [
        ['key' => 'a', 'priority' => 'high', 'tier' => 5],
        ['key' => 'b', 'priority' => 'high', 'tier' => 5],
        ['key' => 'c', 'priority' => 'high', 'tier' => 2],
    ];

    $normalized = RankTierHelper::normalizeTierOrder($entries);

    expect($normalized[0]['tier'])->toBe(2);
    expect($normalized[1]['tier'])->toBe(2);
    expect($normalized[2]['tier'])->toBe(1);
});

test('normalize tier order preserves numeric tier precedence regardless of list order', function () {
    $entries = [
        ['key' => 'DG', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
    ];

    $normalized = RankTierHelper::normalizeTierOrder($entries);

    expect($normalized[0]['tier'])->toBe(2);
    expect($normalized[1]['tier'])->toBe(1);
});

test('entries in the same tier receive the same tier weight', function () {
    $entries = [
        ['key' => 't_0600', 'priority' => 'high', 'tier' => 1],
        ['key' => 't_0700', 'priority' => 'high', 'tier' => 1],
        ['key' => 't_1500', 'priority' => 'low', 'tier' => 2],
    ];

    expect(RankTierHelper::tierWeight($entries, 0))->toBe(2);
    expect(RankTierHelper::tierWeight($entries, 1))->toBe(2);
    expect(RankTierHelper::tierWeight($entries, 2))->toBe(1);
});

test('tier rank for key returns worst rank for unknown keys', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 2],
    ];

    expect(RankTierHelper::tierRankForKey($entries, 'DS'))->toBe(1);
    expect(RankTierHelper::tierRankForKey($entries, 'DG'))->toBe(2);
    expect(RankTierHelper::tierRankForKey($entries, 'ZZ'))->toBe(3);
});

test('missing tiers default to one tier per list position', function () {
    $entries = [
        ['key' => 'a', 'priority' => 'high'],
        ['key' => 'b', 'priority' => 'high'],
        ['key' => 'c', 'priority' => 'high'],
    ];

    $normalized = RankTierHelper::normalizeTierOrder($entries);

    expect($normalized[0]['tier'])->toBe(1);
    expect($normalized[1]['tier'])->toBe(2);
    expect($normalized[2]['tier'])->toBe(3);
});

test('list rank for key follows editor list order', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ['key' => 'AG', 'priority' => 'high', 'tier' => 2],
    ];

    expect(RankTierHelper::listRankForKey($entries, 'DS'))->toBe(1);
    expect(RankTierHelper::listRankForKey($entries, 'DG'))->toBe(2);
    expect(RankTierHelper::listRankForKey($entries, 'AG'))->toBe(3);
    expect(RankTierHelper::listRankForKey($entries, 'MID'))->toBe(4);
});

test('entries to tier groups follow editor list order with sequential groups', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 3],
        ['key' => 'DS_DR_MIX', 'priority' => 'high', 'tier' => 4],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 5],
        ['key' => 'AS', 'priority' => 'high', 'tier' => 6],
    ];

    $groups = RankTierHelper::entriesToTierGroups($entries);

    expect($groups)->toHaveCount(6);
    expect($groups[0][0]['key'])->toBe('DS');
    expect($groups[1][0]['key'])->toBe('DR');
    expect($groups[4][0]['key'])->toBe('DG');
});

test('tier group index uses visual list groups not isolated assigned tier', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DS_DR_MIX', 'priority' => 'high', 'tier' => 4],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 5],
        ['key' => 'AS', 'priority' => 'high', 'tier' => 6],
        ['key' => 'AS15', 'priority' => 'high', 'tier' => 7],
        ['key' => 'AR', 'priority' => 'high', 'tier' => 8],
        ['key' => 'AS_AR_MIX', 'priority' => 'high', 'tier' => 9],
        ['key' => 'AG', 'priority' => 'high', 'tier' => 10],
        ['key' => 'RELIEF', 'priority' => 'high', 'tier' => 11],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 3],
        ['key' => 'MID', 'priority' => 'high', 'tier' => 12],
    ];

    expect(RankTierHelper::tierGroupIndexForKey($entries, 'DS7'))->toBe(11);
    expect(RankTierHelper::tierGroupIndexForKey($entries, 'DG'))->toBe(4);
});

test('tier group index follows editor visual group when buckets are consecutive', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DS_DR_MIX', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 2],
        ['key' => 'AG', 'priority' => 'high', 'tier' => 3],
        ['key' => 'AS', 'priority' => 'high', 'tier' => 3],
        ['key' => 'AS15', 'priority' => 'high', 'tier' => 4],
        ['key' => 'AR', 'priority' => 'high', 'tier' => 4],
        ['key' => 'AS_AR_MIX', 'priority' => 'high', 'tier' => 4],
        ['key' => 'RELIEF', 'priority' => 'high', 'tier' => 5],
        ['key' => 'MID', 'priority' => 'high', 'tier' => 6],
    ];

    expect(RankTierHelper::tierGroupIndexForKey($entries, 'DS7'))->toBe(2);
    expect(collect(RankTierHelper::entriesToTierGroups($entries)[1])->pluck('key')->all())
        ->toBe(['DR', 'DS_DR_MIX', 'DS7']);
});

test('assigned tier groups sort by tier value regardless of list order', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 5],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 3],
    ];

    $groups = RankTierHelper::entriesToAssignedTierGroups($entries);

    expect($groups)->toHaveCount(4);
    expect($groups[2][0]['key'])->toBe('DS7');
});

test('sort entries by tier list order moves lower tiers earlier in desk list', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 2],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 5],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 3],
    ];

    $sorted = RankTierHelper::sortEntriesByTierListOrder($entries);

    expect(collect($sorted)->pluck('key')->all())->toBe(['DS', 'DR', 'DS7', 'DG']);
    expect(RankTierHelper::listRankForKey($sorted, 'DS7'))->toBe(3);
});

test('entries to tier groups combine tied tiers in list order', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 2],
    ];

    $groups = RankTierHelper::entriesToTierGroups($entries);

    expect($groups)->toHaveCount(2);
    expect(collect($groups[0])->pluck('key')->all())->toBe(['DS', 'DR']);
    expect($groups[1][0]['key'])->toBe('DG');
});

test('sync tiers from visual groups renumbers stale tier values in list order', function () {
    $entries = [
        ['key' => 'DS', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DG', 'priority' => 'high', 'tier' => 1],
        ['key' => 'DR', 'priority' => 'high', 'tier' => 5],
        ['key' => 'DS_DR_MIX', 'priority' => 'high', 'tier' => 5],
        ['key' => 'DS7', 'priority' => 'high', 'tier' => 5],
        ['key' => 'AS', 'priority' => 'high', 'tier' => 3],
        ['key' => 'AG', 'priority' => 'high', 'tier' => 3],
        ['key' => 'AS15', 'priority' => 'high', 'tier' => 9],
        ['key' => 'AR', 'priority' => 'high', 'tier' => 10],
        ['key' => 'AS_AR_MIX', 'priority' => 'high', 'tier' => 11],
        ['key' => 'RELIEF', 'priority' => 'high', 'tier' => 4],
        ['key' => 'MID', 'priority' => 'high', 'tier' => 12],
    ];

    $synced = RankTierHelper::syncTiersFromVisualGroups($entries);

    expect(collect($synced)->pluck('tier', 'key')->all())->toBe([
        'DS' => 1,
        'DG' => 1,
        'DR' => 2,
        'DS_DR_MIX' => 2,
        'DS7' => 2,
        'AS' => 3,
        'AG' => 3,
        'AS15' => 4,
        'AR' => 5,
        'AS_AR_MIX' => 6,
        'RELIEF' => 7,
        'MID' => 8,
    ]);
});
