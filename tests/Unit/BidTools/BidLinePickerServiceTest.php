<?php

use App\Models\BidLine;
use App\Services\BidTools\BidLinePickerService;
use App\Services\BidTools\CondensedDeskClassifier;
use App\Services\BidTools\LineShiftClassifier;
use App\Services\BidTools\StartTimeNormalizer;
use Tests\TestCase;

uses(TestCase::class);

test('line picker rows sort by am pm mid relief then line number', function () {
    $service = new BidLinePickerService(
        new CondensedDeskClassifier(
            new StartTimeNormalizer,
            new LineShiftClassifier(new StartTimeNormalizer),
        ),
    );

    $rows = [
        ['id' => 1, 'line_num' => '200', 'desk_group' => 'MG', 'start_time' => '2200', 'desk_shift' => 'mid', 'desk_bucket' => 'MID'],
        ['id' => 2, 'line_num' => '100', 'desk_group' => 'AG', 'start_time' => '1500', 'desk_shift' => 'pm', 'desk_bucket' => 'XG'],
        ['id' => 3, 'line_num' => '050', 'desk_group' => 'DG', 'start_time' => '0600', 'desk_shift' => 'am', 'desk_bucket' => 'XG'],
        ['id' => 4, 'line_num' => '300', 'desk_group' => 'DG', 'start_time' => '0600', 'desk_shift' => 'relief', 'desk_bucket' => 'RELIEF'],
    ];

    $method = new ReflectionMethod(BidLinePickerService::class, 'sortPickerRows');
    $method->setAccessible(true);

    $sorted = $method->invoke($service, $rows);

    expect(array_column($sorted, 'line_num'))->toBe(['050', '100', '200', '300']);
});

test('classifies desk group prefix for shift buckets', function () {
    $classifier = new LineShiftClassifier(new StartTimeNormalizer);

    $line = new BidLine([
        'desk_group' => 'DS4',
        'start_time' => '1500',
    ]);
    $line->setRelation('days', collect());

    expect($classifier->classify($line))->toBe('am');
});
