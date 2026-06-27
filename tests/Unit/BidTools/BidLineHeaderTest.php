<?php

use App\Services\BidTools\BidLineHeader;

test('bid line header detector accepts common line number labels', function () {
    expect(BidLineHeader::isLineNumColumn('Line Num'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('line number'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('Line #'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('Line No.'))->toBeTrue();
    expect(BidLineHeader::isLineNumColumn('Group'))->toBeFalse();
});

test('bid line header detector finds header away from column a', function () {
    $found = BidLineHeader::findInRows([
        ['', '', 'Line Number', 'Group'],
        ['', '', '1', 'DG'],
    ]);

    expect($found)->toBe([0, 2]);
});
