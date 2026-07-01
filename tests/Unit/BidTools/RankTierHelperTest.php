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
