<?php

use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Services\BidTools\CondensedDeskClassifier;
use Carbon\CarbonImmutable;

function makeClassifierLine(array $workCodes, string $deskGroup = 'DG', string $startTime = '0600'): BidLine
{
    $line = new BidLine([
        'desk_group' => $deskGroup,
        'start_time' => $startTime,
    ]);
    $line->setRelation('days', collect($workCodes)->map(function (array $entry, int $idx) {
        $day = new BidLineDay([
            'assignment_date' => CarbonImmutable::create(2026, 3, 1)->addDays($idx),
            'raw_cell' => $entry['raw'] ?? $entry['code'],
            'is_off' => $entry['off'] ?? false,
            'normalized_code' => ($entry['off'] ?? false) ? null : strtoupper($entry['code']),
        ]);

        return $day;
    }));

    return $line;
}

test('maps regional router sector and midnight desk codes', function () {
    $classifier = app(CondensedDeskClassifier::class);

    expect($classifier->bucketForNormalizedCode('AG1'))->toBe('XG');
    expect($classifier->bucketForNormalizedCode('DG'))->toBe('XG');
    expect($classifier->bucketForNormalizedCode('AR'))->toBe('XR');
    expect($classifier->bucketForNormalizedCode('DR2'))->toBe('XR');
    expect($classifier->bucketForNormalizedCode('AS'))->toBe('XS');
    expect($classifier->bucketForNormalizedCode('DS4'))->toBe('XS');
    expect($classifier->bucketForNormalizedCode('MS'))->toBe('MID');
    expect($classifier->bucketForNormalizedCode('MG1'))->toBe('MID');
    expect($classifier->bucketForNormalizedCode('RELIEF-S4'))->toBe('RELIEF');
});

test('classifies mixed start times into router and midnight buckets', function () {
    $classifier = app(CondensedDeskClassifier::class);

    expect($classifier->bucketForStartTimeMix('AM-MIX 0600 0700'))->toBe('XR');
    expect($classifier->bucketForStartTimeMix('PM-MIX'))->toBe('XR');
    expect($classifier->bucketForStartTimeMix('MID-MIX'))->toBe('MID');
});

test('classifies a line from dominant workday desk codes', function () {
    $classifier = app(CondensedDeskClassifier::class);

    $regional = makeClassifierLine([
        ['code' => 'AG1'],
        ['code' => 'AG1'],
        ['code' => 'DG2'],
    ]);
    expect($classifier->bucketForLine($regional))->toBe('XG');

    $router = makeClassifierLine([
        ['code' => 'AR'],
        ['code' => 'DR1'],
    ]);
    expect($classifier->bucketForLine($router))->toBe('XR');

    $sector = makeClassifierLine([
        ['code' => 'AS'],
        ['code' => 'DS'],
    ]);
    expect($classifier->bucketForLine($sector))->toBe('XS');

    $midnight = makeClassifierLine([
        ['code' => 'MS'],
        ['code' => 'MG'],
    ], deskGroup: 'MG', startTime: '2200');
    expect($classifier->bucketForLine($midnight))->toBe('MID');
});

test('classifies mixed group and start time lines into router or midnight', function () {
    $classifier = app(CondensedDeskClassifier::class);

    $amMix = makeClassifierLine([], deskGroup: 'AM/PM MIX', startTime: 'AM-MIX 0600 0700');
    expect($classifier->bucketForLine($amMix))->toBe('XR');

    $midMix = makeClassifierLine([], deskGroup: 'MID MIX', startTime: 'MID-MIX');
    expect($classifier->bucketForLine($midMix))->toBe('MID');
});
