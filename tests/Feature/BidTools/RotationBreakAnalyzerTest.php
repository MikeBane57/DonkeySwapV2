<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Models\User;
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
});
