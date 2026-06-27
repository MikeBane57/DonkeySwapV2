<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Models\User;
use App\Services\BidTools\LineRowFormatter;
use App\Services\BidTools\RotationBreakAnalyzer;

test('rotation analyzer flags non 3 or 5 off runs', function () {
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
            'raw_cell' => $off ? 'x' : 'DG1',
            'is_off' => $off,
            'normalized_code' => $off ? null : 'DG1',
        ]);
        $d = $d->addDay();
    }

    $line->load('days');
    $out = (new RotationBreakAnalyzer)->analyze($line);

    expect($out['non_canonical_runs'])->toContain(4);
    expect($out['non_canonical_run_details'])->toHaveCount(1);
    expect($out['non_canonical_run_details'][0]['length'])->toBe(4);
    expect($out['non_canonical_run_details'][0]['days'])->toHaveCount(4);
    expect($out['non_canonical_alerts'])->toHaveCount(1);
    expect($out['non_canonical_alerts'][0]['work_length'])->toBe(1);
    expect($out['non_canonical_alerts'][0]['code'])->toBe('DG1');
});

test('rotation analyzer alerts first day of extended work week after non canonical off', function () {
    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => 2031,
        'file_hash' => 'y',
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
        'workdays_computed' => 11,
    ]);

    $pattern = array_merge(
        array_fill(0, 5, false),
        array_fill(0, 4, true),
        array_fill(0, 6, false),
    );

    $d = now()->startOfDay();
    foreach ($pattern as $off) {
        BidLineDay::create([
            'bid_line_id' => $line->id,
            'assignment_date' => $d->format('Y-m-d'),
            'raw_cell' => $off ? 'x' : 'S4',
            'is_off' => $off,
            'normalized_code' => $off ? null : 'S4',
        ]);
        $d = $d->addDay();
    }

    $line->load('days');
    $out = (new RotationBreakAnalyzer)->analyze($line);
    $formatted = app(LineRowFormatter::class)->format($line->fresh());

    expect($out['non_canonical_alerts'])->toHaveCount(1);
    expect($out['non_canonical_alerts'][0]['off_length'])->toBe(4);
    expect($out['non_canonical_alerts'][0]['work_length'])->toBe(6);
    expect($formatted['schedule_callouts'])->toContain('6d work from');
    expect($formatted['schedule_callouts'])->toContain('S4');
    expect($formatted['schedule_callouts'])->not->toMatch('/off, /');
});
