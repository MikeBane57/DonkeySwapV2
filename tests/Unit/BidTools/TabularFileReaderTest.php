<?php

use App\Services\BidTools\TabularFileReader;
use Tests\TestCase;

uses(TestCase::class);

test('tabular file reader reads xlsx rows', function () {
    if (! class_exists(ZipArchive::class)) {
        $this->markTestSkipped('ZipArchive extension is not available.');
    }

    $path = writeXlsxWithRows([
        ['Line Num', 'Group'],
        ['1', 'DG'],
    ]);

    $rows = TabularFileReader::read($path);

    expect($rows)->toHaveCount(2);
    expect($rows[0][0])->toBe('Line Num');
    expect($rows[1][1])->toBe('DG');

    @unlink($path);
});
