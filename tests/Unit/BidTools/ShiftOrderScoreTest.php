<?php

use App\Services\BidTools\ScenarioScoreService;

test('shift order breaks ties by desk shift before line number', function () {
    $criteriaOrder = ['holiday', 'personal', 'start_time', 'desk'];

    $pmLine = [
        'total' => 10,
        'line_num' => '100',
        'desk_shift' => 'pm',
        'tier_ranks' => [],
        'parts' => [],
    ];
    $amLine = [
        'total' => 10,
        'line_num' => '50',
        'desk_shift' => 'am',
        'tier_ranks' => [],
        'parts' => [],
    ];

    $defaultOrder = ScenarioScoreService::compareScoredLines(
        $pmLine,
        $amLine,
        $criteriaOrder,
        'weighted',
        false,
        ['am', 'pm', 'mid'],
    );
    expect($defaultOrder)->toBeGreaterThan(0);

    $pmFirst = ScenarioScoreService::compareScoredLines(
        $pmLine,
        $amLine,
        $criteriaOrder,
        'weighted',
        false,
        ['pm', 'am', 'mid'],
    );
    expect($pmFirst)->toBeLessThan(0);
});

test('normalize shift order fills missing shifts and drops invalid values', function () {
    expect(ScenarioScoreService::normalizeShiftOrder(['mid', 'am']))->toBe(['mid', 'am', 'pm']);
    expect(ScenarioScoreService::normalizeShiftOrder(null))->toBe(['am', 'pm', 'mid']);
    expect(ScenarioScoreService::normalizeShiftOrder(['am', 'am', 'nope', 'pm']))->toBe(['am', 'pm', 'mid']);
});

test('normalize strict shift rank fills missing buckets and drops invalid values', function () {
    expect(ScenarioScoreService::normalizeStrictShiftRank(['pm', 'mid', 'am']))->toBe(['pm', 'mid', 'am', 'relief']);
    expect(ScenarioScoreService::normalizeStrictShiftRank(null))->toBe(['am', 'pm', 'mid', 'relief']);
});

test('strict shift rank breaks ties before other criteria when enabled', function () {
    $criteriaOrder = ['holiday', 'personal', 'start_time', 'desk'];

    $pmLine = [
        'total' => 5,
        'line_num' => '100',
        'shift_class' => 'pm',
        'tier_ranks' => [],
        'parts' => [],
    ];
    $amLine = [
        'total' => 10,
        'line_num' => '50',
        'shift_class' => 'am',
        'tier_ranks' => [],
        'parts' => [],
    ];

    $amFirst = ScenarioScoreService::compareScoredLines(
        $pmLine,
        $amLine,
        $criteriaOrder,
        'weighted',
        true,
        ['am', 'pm', 'mid'],
        ['am', 'pm', 'mid', 'relief'],
    );
    expect($amFirst)->toBeGreaterThan(0);

    $pmFirst = ScenarioScoreService::compareScoredLines(
        $pmLine,
        $amLine,
        $criteriaOrder,
        'weighted',
        true,
        ['am', 'pm', 'mid'],
        ['pm', 'mid', 'am', 'relief'],
    );
    expect($pmFirst)->toBeLessThan(0);
});
