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
