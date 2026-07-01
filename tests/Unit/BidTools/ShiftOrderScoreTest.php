<?php

use App\Services\BidTools\ScenarioScoreService;

test('start time tiebreak order breaks ties before line number', function () {
    $criteriaOrder = ['holiday', 'personal', 'desk'];

    $sevenLine = [
        'total' => 10,
        'line_num' => '100',
        'start_time_tiebreak_key' => '7',
        'tier_ranks' => ['desk' => 1],
        'parts' => [],
    ];
    $sixLine = [
        'total' => 10,
        'line_num' => '50',
        'start_time_tiebreak_key' => '6',
        'tier_ranks' => ['desk' => 1],
        'parts' => [],
    ];

    $sixFirst = ScenarioScoreService::compareScoredLines(
        $sevenLine,
        $sixLine,
        $criteriaOrder,
        'weighted',
        ['6', '7', '14', '15', '22'],
    );
    expect($sixFirst)->toBeGreaterThan(0);

    $sevenFirst = ScenarioScoreService::compareScoredLines(
        $sevenLine,
        $sixLine,
        $criteriaOrder,
        'weighted',
        ['7', '6', '14', '15', '22'],
    );
    expect($sevenFirst)->toBeLessThan(0);
});

test('normalize start time tiebreak order fills missing hours and migrates legacy shift order', function () {
    expect(ScenarioScoreService::normalizeStartTimeTiebreakOrder(['7', '6']))->toBe(['7', '6', '14', '15', '22']);
    expect(ScenarioScoreService::normalizeStartTimeTiebreakOrder(null))->toBe(['6', '7', '14', '15', '22']);
    expect(ScenarioScoreService::normalizeStartTimeTiebreakOrder(['pm', 'am']))->toBe(['14', '15', '6', '7', '22']);
    expect(ScenarioScoreService::normalizeShiftOrder(['mid', 'am']))->toBe(['22', '6', '7', '14', '15']);
});

test('criteria order defaults to holiday personal desk only', function () {
    expect(ScenarioScoreService::normalizeCriteriaOrder(null))->toBe(['holiday', 'personal', 'desk']);
    expect(ScenarioScoreService::normalizeCriteriaOrder(['desk', 'start_time', 'holiday']))->toBe(['desk', 'holiday', 'personal']);
});
