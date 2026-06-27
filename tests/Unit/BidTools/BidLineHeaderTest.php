<?php

use App\Services\BidTools\BidLineHeader;

test('bid line header detector accepts common line number labels', function () {
    expect(BidLineHeader::isLineNumColumn('Line Num'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('line number'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('Line #'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('Line No.'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('Group'))->toBeFalse();
});

test('bid line header detector finds header with date columns', function () {
    $dates = [];
    for ($d = 1; $d <= 28; $d++) {
        $dates[] = $d.'-Feb-26';
    }

    $found = BidLineHeader::findHeaderRow([
        array_merge(['Line Num', 'Group', 'Start Time', 'Rotation'], $dates),
        array_merge(['1', 'DG', '0600', 'A'], array_fill(0, 28, 'x')),
    ]);

    expect($found)->not->toBeNull();
    expect($found[2])->toBe(28);
});

test('bid line header detector ignores line number label without dates', function () {
    $found = BidLineHeader::findHeaderRow([
        ['Instructions'],
        ['Line Number', 'Group', 'Start Time', 'Rotation'],
    ]);

    expect($found)->toBeNull();
});

test('bid line header detector finds header away from column a', function () {
    $dates = [];
    for ($d = 1; $d <= 20; $d++) {
        $dates[] = $d.'-Feb-26';
    }

    $found = BidLineHeader::findHeaderRow([
        array_merge(['', '', 'Line Number', 'Group', 'Start Time', 'Rotation'], $dates),
        array_merge(['', '', '1', 'DG', '0600', 'A'], array_fill(0, 20, 'x')),
    ]);

    expect($found)->not->toBeNull();
    expect($found[1])->toBe(2);
});
