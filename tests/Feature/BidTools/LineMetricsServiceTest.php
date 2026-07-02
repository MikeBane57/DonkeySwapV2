<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Models\User;
use App\Services\BidTools\FederalHolidayCalendar;
use App\Services\BidTools\LineMetricsService;

test('line metrics track key holiday group off counts', function () {
    $bidYear = 2026;
    $calendar = app(FederalHolidayCalendar::class);
    $catalog = $calendar->holidaysInBidYear($bidYear);

    $datesById = [];
    foreach ($catalog as $date => $meta) {
        $datesById[$meta['id']] = $date;
    }

    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => $bidYear,
        'file_hash' => 'metrics-key-holidays',
        'original_filename' => 't.csv',
        'is_current' => true,
        'meta' => [],
    ]);

    $line = BidLine::create([
        'bid_import_id' => $import->id,
        'line_num' => '100',
        'desk_group' => 'DG',
        'start_time' => '0600',
        'rotation' => 'A',
        'workdays_from_file' => null,
        'workdays_computed' => 1,
    ]);

    foreach ($catalog->keys() as $date) {
        $isOff = in_array($date, [
            $datesById['christmas_eve'],
            $datesById['christmas_day'],
            $datesById['thanksgiving'],
            $datesById['july_4'],
        ], true);

        BidLineDay::create([
            'bid_line_id' => $line->id,
            'assignment_date' => $date,
            'raw_cell' => $isOff ? 'x' : 'DG',
            'is_off' => $isOff,
            'normalized_code' => $isOff ? null : 'DG',
        ]);
    }

    $metrics = app(LineMetricsService::class)->analyze($line->fresh());

    expect($metrics['key_holidays']['christmas'])->toBe(['off' => 2, 'total' => 2]);
    expect($metrics['key_holidays']['thanksgiving'])->toBe(['off' => 1, 'total' => 2]);
    expect($metrics['key_holidays']['july_4'])->toBe(['off' => 1, 'total' => 1]);
});
