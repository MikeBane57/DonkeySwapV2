<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Models\User;
use App\Services\BidTools\LineRowFormatter;

test('schedule callouts include non canonical off dates and desk labels', function () {
    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => 2031,
        'file_hash' => 'x',
        'original_filename' => 't.csv',
        'is_current' => true,
        'meta' => [],
    ]);

    $line = BidLine::create([
        'bid_import_id' => $import->id,
        'line_num' => '9',
        'desk_group' => 'DG',
        'start_time' => '0600',
        'rotation' => 'A',
        'workdays_from_file' => null,
        'workdays_computed' => 4,
    ]);

    $d = now()->startOfDay();
    foreach ([false, false, false, false, true, true, true, true, false] as $off) {
        BidLineDay::create([
            'bid_line_id' => $line->id,
            'assignment_date' => $d->format('Y-m-d'),
            'raw_cell' => $off ? 'x' : 'S4',
            'is_off' => $off,
            'normalized_code' => $off ? null : 'S4',
        ]);
        $d = $d->addDay();
    }

    $formatted = app(LineRowFormatter::class)->format($line->fresh());

    expect($formatted['schedule_callouts'])->toContain('Non–3/5 off (4d)');
    expect($formatted['schedule_callouts'])->toContain('1d work from');
    expect($formatted['schedule_callouts'])->toContain('S4');
    expect($formatted['schedule_callouts'])->not->toContain('off.');
});

test('schedule callouts include relief work dates with desk codes', function () {
    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => 2031,
        'file_hash' => 'x2',
        'original_filename' => 't.csv',
        'is_current' => true,
        'meta' => [],
    ]);

    $line = BidLine::create([
        'bid_import_id' => $import->id,
        'line_num' => '10',
        'desk_group' => 'DG',
        'start_time' => '0600',
        'rotation' => 'A',
        'workdays_from_file' => null,
        'workdays_computed' => 1,
    ]);

    $workDate = now()->startOfDay();
    BidLineDay::create([
        'bid_line_id' => $line->id,
        'assignment_date' => $workDate->format('Y-m-d'),
        'raw_cell' => 'RELIEF-S4',
        'is_off' => false,
        'normalized_code' => 'RELIEF-S4',
    ]);

    $formatted = app(LineRowFormatter::class)->format($line->fresh());

    expect($formatted['schedule_callouts'])->toContain('Work outside rotation:');
    expect($formatted['schedule_callouts'])->toContain('RELIEF-S4');
});
