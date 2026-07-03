<?php

use App\Services\BidTools\ManualLineOrderService;

test('manual line order service reorders scored lines and appends missing lines', function () {
    $service = app(ManualLineOrderService::class);

    $scored = [
        ['bid_line_id' => 10, 'line_num' => 'A'],
        ['bid_line_id' => 20, 'line_num' => 'B'],
        ['bid_line_id' => 30, 'line_num' => 'C'],
    ];

    $reordered = $service->apply($scored, [30, 10]);

    expect(array_column($reordered, 'bid_line_id'))->toBe([30, 10, 20]);
});

test('manual line order service normalizes unknown line ids', function () {
    $service = app(ManualLineOrderService::class);

    $normalized = $service->normalize([99, 10, 10, 20], [10, 20, 30]);

    expect($normalized)->toBe([10, 20]);
});

test('manual line order service returns null for empty order', function () {
    $service = app(ManualLineOrderService::class);

    expect($service->normalize([], [10, 20]))->toBeNull();
    expect($service->normalize(null, [10, 20]))->toBeNull();
});
