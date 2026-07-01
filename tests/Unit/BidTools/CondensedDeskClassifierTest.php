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

test('maps AM desk groups to DS DG DS7 and DR buckets', function () {
    $classifier = classifier();

    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DS', startTime: '0600')))->toBe('DS');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DS', startTime: '0700')))->toBe('DS7');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DG', startTime: '0600')))->toBe('DG');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DG', startTime: '0700')))->toBe('DG');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DR', startTime: '0600')))->toBe('DR');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DR', startTime: '0700')))->toBe('DR');
});

test('maps PM desk groups to AS AG AS15 and AR buckets', function () {
    $classifier = classifier();

    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'AS', startTime: '1400')))->toBe('AS');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'AS', startTime: '1500')))->toBe('AS15');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'AG', startTime: '1500')))->toBe('AG');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'AR', startTime: '1400')))->toBe('AR');
});

test('classifies midnight and relief buckets', function () {
    $classifier = classifier();

    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'MS', startTime: '2200')))->toBe('MID');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'MG', startTime: '2200')))->toBe('MID');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'MG/MS', startTime: '2200')))->toBe('MID');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'RELIEF', startTime: '0600')))->toBe('RELIEF');
    expect($classifier->bucketForLine(makeClassifierLine([['code' => 'RELIEF-S4']], deskGroup: 'DG', startTime: '0600')))->toBe('RELIEF');
});

test('desk catalog lists every bucket type for ranking UI', function () {
    $classifier = classifier();

    expect($classifier->deskCatalogForImport(0))
        ->toHaveCount(count(CondensedDeskClassifier::BUCKETS));

    $keys = collect($classifier->deskCatalogForImport(0))->pluck('key')->all();

    expect($keys)->toContain('DS7');
    expect($keys)->toContain('RELIEF');
});

test('does not classify non-mid MG or MS prefixed mix groups as mid', function () {
    $classifier = classifier();

    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'MG/DS', startTime: '0600')))->not->toBe('MID');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'MS/DR', startTime: '0700')))->not->toBe('MID');
});

test('does not classify 2200 starts as mid without MS or MG desk group', function () {
    $classifier = classifier();

    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DG', startTime: '2200')))->toBe('DG');
});

test('classifies mixed lines into DS_DR_MIX and AS_AR_MIX buckets from desk group', function () {
    $classifier = classifier();

    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DS/DR MIX', startTime: '0600')))->toBe('DS_DR_MIX');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'AS/AR MIX', startTime: '1500')))->toBe('AS_AR_MIX');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'MID MIX', startTime: 'MID-MIX')))->toBe('MID');
});

test('does not classify am or pm mix starts as desk mix without mixed desk group', function () {
    $classifier = classifier();

    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'DG', startTime: 'AM-MIX 0600 0700')))->toBe('DG');
    expect($classifier->bucketForLine(makeClassifierLine([], deskGroup: 'AG', startTime: 'PM-MIX')))->toBe('AG');
});

test('falls back to dominant work code when desk group is empty', function () {
    $classifier = classifier();

    $line = makeClassifierLine([['code' => 'DS']], deskGroup: '', startTime: '0700');

    expect($classifier->bucketForLine($line))->toBe('DS7');
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

    $line = makeClassifierLine([], deskGroup: 'DS', startTime: '0700');
    $fields = $classifier->linePickerFields($line);

    expect($fields['desk_bucket'])->toBe('DS7');
});

test('normalizes legacy bucket keys', function () {
    $classifier = classifier();

    expect($classifier->normalizeBucketKey('DG7'))->toBe('DG');
    expect($classifier->normalizeBucketKey('AS7'))->toBe('AS15');
});

test('manual desk bucket mappings override auto classification', function () {
    $classifier = classifier();

    $line = makeClassifierLine([], deskGroup: 'MG/DS', startTime: '0600');

    expect($classifier->bucketForLine($line))->not->toBe('MID');

    $mapped = $classifier->bucketForLine($line, [
        ['desk_group' => 'MG/DS', 'start_time' => '0600', 'bucket' => 'MID'],
    ]);

    expect($mapped)->toBe('MID');
});

test('group-only mapping applies when start-specific mapping is absent', function () {
    $classifier = classifier();

    $line = makeClassifierLine([], deskGroup: 'DG', startTime: '2200');

    expect($classifier->bucketForLine($line))->toBe('DG');

    $mapped = $classifier->bucketForLine($line, [
        ['desk_group' => 'DG', 'start_time' => null, 'bucket' => 'MID'],
    ]);

    expect($mapped)->toBe('MID');
});

test('start-specific mapping wins over group-only mapping', function () {
    $classifier = classifier();

    $line = makeClassifierLine([], deskGroup: 'DS', startTime: '0700');

    $mapped = $classifier->bucketForLine($line, [
        ['desk_group' => 'DS', 'start_time' => null, 'bucket' => 'DS'],
        ['desk_group' => 'DS', 'start_time' => '0700', 'bucket' => 'DS7'],
    ]);

    expect($mapped)->toBe('DS7');
});
