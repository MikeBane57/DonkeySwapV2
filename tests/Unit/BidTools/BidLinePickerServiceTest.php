<?php

use App\Services\BidTools\BidLinePickerService;
use App\Services\BidTools\CondensedDeskClassifier;
use App\Services\BidTools\StartTimeNormalizer;
use Tests\TestCase;

uses(TestCase::class);

test('line picker rows sort by desk bucket order then line number', function () {
    $service = new BidLinePickerService(
        new CondensedDeskClassifier(new StartTimeNormalizer),
    );

    $rows = [
        ['id' => 1, 'line_num' => '200', 'desk_group' => 'MG', 'start_time' => '2200', 'desk_bucket' => 'MID'],
        ['id' => 2, 'line_num' => '100', 'desk_group' => 'AG', 'start_time' => '1500', 'desk_bucket' => 'AG'],
        ['id' => 3, 'line_num' => '050', 'desk_group' => 'DG', 'start_time' => '0600', 'desk_bucket' => 'DG'],
        ['id' => 4, 'line_num' => '300', 'desk_group' => 'DG', 'start_time' => '0600', 'desk_bucket' => 'RELIEF'],
    ];

    $method = new ReflectionMethod(BidLinePickerService::class, 'sortPickerRows');
    $method->setAccessible(true);

    $sorted = $method->invoke($service, $rows);

    expect(array_column($sorted, 'line_num'))->toBe(['050', '100', '200', '300']);
});
