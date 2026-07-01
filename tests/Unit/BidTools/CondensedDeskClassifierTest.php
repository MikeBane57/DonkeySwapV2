<?php

use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Services\BidTools\CondensedDeskClassifier;
use App\Services\BidTools\StartTimeNormalizer;
use Carbon\CarbonImmutable;
use Tests\TestCase;

uses(TestCase::class);

function classifier(): CondensedDeskClassifier
{
    return new CondensedDeskClassifier(new StartTimeNormalizer);
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

test('maps regional router and sector lines to desk buckets by shift', function () {
    $classifier = classifier();

    $regionalAm = makeClassifierLine([['code' => 'DG']], deskGroup: 'DG', startTime: '0600');
    $regionalPm = makeClassifierLine([['code' => 'AG']], deskGroup: 'AG', startTime: '1500');
    $routerAm = makeClassifierLine([['code' => 'DR']], deskGroup: 'DR', startTime: '0700');
    $routerPm = makeClassifierLine([['code' => 'AR']], deskGroup: 'AR', startTime: '1400');
    $sectorAm = makeClassifierLine([['code' => 'DS']], deskGroup: 'DS', startTime: '0700');
    $sectorPm = makeClassifierLine([['code' => 'AS']], deskGroup: 'AS', startTime: '1500');

    expect($classifier->bucketForLine($regionalAm))->toBe('DG7');
    expect($classifier->bucketForLine($regionalPm))->toBe('AG15');
    expect($classifier->bucketForLine($routerAm))->toBe('DR7');
    expect($classifier->bucketForLine($routerPm))->toBe('AR15');
    expect($classifier->bucketForLine($sectorAm))->toBe('DS7');
    expect($classifier->bucketForLine($sectorPm))->toBe('AS7');
});

test('classifies midnight and relief buckets', function () {
    $classifier = classifier();

    $midnight = makeClassifierLine([['code' => 'MS']], deskGroup: 'MG', startTime: '2200');
    $relief = makeClassifierLine([['code' => 'RELIEF-S4']], deskGroup: 'DG', startTime: '0600');

    expect($classifier->bucketForLine($midnight))->toBe('MID');
    expect($classifier->bucketForLine($relief))->toBe('RELIEF');
});

test('classifies mixed lines into DS7 and AS7 buckets', function () {
    $classifier = classifier();

    $dsDrMix = makeClassifierLine([], deskGroup: 'DS/DR MIX', startTime: 'AM-MIX 0600 0700');
    $asArMix = makeClassifierLine([], deskGroup: 'AS/AR MIX', startTime: 'PM-MIX');
    $midMix = makeClassifierLine([], deskGroup: 'MID MIX', startTime: 'MID-MIX');

    expect($classifier->bucketForLine($dsDrMix))->toBe('DS7');
    expect($classifier->bucketForLine($asArMix))->toBe('AS7');
    expect($classifier->bucketForLine($midMix))->toBe('MID');
});

test('maps start times to tiebreak keys', function () {
    $classifier = classifier();

    expect($classifier->startTimeTiebreakKey(makeClassifierLine([], startTime: '0600')))->toBe('6');
    expect($classifier->startTimeTiebreakKey(makeClassifierLine([], startTime: '0700')))->toBe('7');
    expect($classifier->startTimeTiebreakKey(makeClassifierLine([], startTime: '1500')))->toBe('15');
    expect($classifier->startTimeTiebreakKey(makeClassifierLine([], startTime: '2200')))->toBe('22');
    expect($classifier->startTimeTiebreakKey(makeClassifierLine([], startTime: 'AM-MIX 0600 0700')))->toBe('6');
});

test('line picker fields expose desk bucket', function () {
    $classifier = classifier();

    $line = makeClassifierLine([['code' => 'DS']], deskGroup: 'DS', startTime: '0700');
    $fields = $classifier->linePickerFields($line);

    expect($fields['desk_bucket'])->toBe('DS7');
});
