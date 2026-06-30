<?php

use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Services\BidTools\CondensedDeskClassifier;
use App\Services\BidTools\LineShiftClassifier;
use App\Services\BidTools\StartTimeNormalizer;
use Carbon\CarbonImmutable;
use Tests\TestCase;

uses(TestCase::class);

function classifier(): CondensedDeskClassifier
{
    return new CondensedDeskClassifier(
        new StartTimeNormalizer,
        new LineShiftClassifier(new StartTimeNormalizer),
    );
}

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
    $classifier = classifier();

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
    $classifier = classifier();

    expect($classifier->bucketForStartTimeMix('AM-MIX 0600 0700'))->toBe('XR');
    expect($classifier->bucketForStartTimeMix('PM-MIX'))->toBe('XR');
    expect($classifier->bucketForStartTimeMix('MID-MIX'))->toBe('MID');
});

test('classifies a line from dominant workday desk codes', function () {
    $classifier = classifier();

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
    $classifier = classifier();

    $amMix = makeClassifierLine([], deskGroup: 'AM/PM MIX', startTime: 'AM-MIX 0600 0700');
    expect($classifier->bucketForLine($amMix))->toBe('XR');

    $midMix = makeClassifierLine([], deskGroup: 'MID MIX', startTime: 'MID-MIX');
    expect($classifier->bucketForLine($midMix))->toBe('MID');
});

test('maps start times to am pm and mid picker buckets', function () {
    $classifier = classifier();

    expect($classifier->startShiftBucket('0600'))->toBe('am');
    expect($classifier->startShiftBucket('AM-MIX 0600 0700'))->toBe('am');
    expect($classifier->startShiftBucket('1500'))->toBe('pm');
    expect($classifier->startShiftBucket('PM-MIX'))->toBe('pm');
    expect($classifier->startShiftBucket('2200'))->toBe('mid');
    expect($classifier->startShiftBucket('MID-MIX'))->toBe('mid');
});

test('line picker shift uses desk group prefix and relief classification', function () {
    $classifier = classifier();

    $amLine = makeClassifierLine([], deskGroup: 'DG', startTime: '1500');
    expect($classifier->linePickerFields($amLine)['desk_shift'])->toBe('am');

    $pmLine = makeClassifierLine([], deskGroup: 'AG', startTime: '0600');
    expect($classifier->linePickerFields($pmLine)['desk_shift'])->toBe('pm');

    $midLine = makeClassifierLine([], deskGroup: 'MG', startTime: '0600');
    expect($classifier->linePickerFields($midLine)['desk_shift'])->toBe('mid');

    $relief = makeClassifierLine([
        ['code' => 'RELIEF-S4'],
    ], deskGroup: 'DG', startTime: '0600');
    expect($classifier->linePickerFields($relief)['desk_shift'])->toBe('relief');
});
