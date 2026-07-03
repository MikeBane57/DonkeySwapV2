<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Models\User;
use App\Services\BidTools\BidYearRange;
use App\Services\BidTools\FederalHolidayCalendar;
use App\Services\BidTools\LineMetricsService;
use Carbon\CarbonImmutable;

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

    expect($metrics['key_holidays']['christmas'])->toMatchArray([
        'off' => 2,
        'total' => 2,
        'anchor_label' => 'Christmas Day',
        'anchor_off' => true,
        'days_off_before' => 1,
        'days_off_after' => 0,
    ]);
    expect($metrics['key_holidays']['thanksgiving'])->toMatchArray([
        'off' => 1,
        'total' => 2,
        'anchor_label' => 'Thanksgiving',
        'anchor_off' => true,
        'days_off_before' => 0,
        'days_off_after' => 0,
    ]);
    expect($metrics['key_holidays']['july_4'])->toMatchArray([
        'off' => 1,
        'total' => 1,
        'anchor_label' => 'July 4',
        'anchor_off' => true,
        'days_off_before' => 0,
        'days_off_after' => 0,
    ]);
});

test('line metrics count days off before anchor holiday date', function () {
    $bidYear = 2026;
    $calendar = app(FederalHolidayCalendar::class);
    $catalog = $calendar->holidaysInBidYear($bidYear);
    $range = BidYearRange::fromBidYear($bidYear);

    $christmasDay = null;
    foreach ($catalog as $date => $meta) {
        if ($meta['id'] === 'christmas_day') {
            $christmasDay = $date;
            break;
        }
    }

    expect($christmasDay)->not->toBeNull();

    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => $bidYear,
        'file_hash' => 'metrics-christmas-context',
        'original_filename' => 't.csv',
        'is_current' => true,
        'meta' => [],
    ]);

    $line = BidLine::create([
        'bid_import_id' => $import->id,
        'line_num' => '101',
        'desk_group' => 'DG',
        'start_time' => '0600',
        'rotation' => 'A',
        'workdays_from_file' => null,
        'workdays_computed' => 1,
    ]);

    $anchor = CarbonImmutable::parse($christmasDay);
    $offDates = [
        $anchor->subDays(2)->format('Y-m-d'),
        $anchor->subDays(1)->format('Y-m-d'),
        $christmasDay,
    ];

    foreach ($range->eachDate() as $date) {
        $ymd = $date->format('Y-m-d');
        $isOff = in_array($ymd, $offDates, true);

        BidLineDay::create([
            'bid_line_id' => $line->id,
            'assignment_date' => $ymd,
            'raw_cell' => $isOff ? 'x' : 'DG',
            'is_off' => $isOff,
            'normalized_code' => $isOff ? null : 'DG',
        ]);
    }

    $metrics = app(LineMetricsService::class)->analyze($line->fresh());

    expect($metrics['key_holidays']['christmas'])->toMatchArray([
        'off' => 2,
        'total' => 2,
        'anchor_label' => 'Christmas Day',
        'anchor_off' => true,
        'days_off_before' => 2,
        'days_off_after' => 0,
    ]);
});

test('line metrics track sept feb weekend counts separately from full year', function () {
    $bidYear = 2026;
    $range = BidYearRange::fromBidYear($bidYear);

    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => $bidYear,
        'file_hash' => 'metrics-sept-feb',
        'original_filename' => 't.csv',
        'is_current' => true,
        'meta' => [],
    ]);

    $line = BidLine::create([
        'bid_import_id' => $import->id,
        'line_num' => '102',
        'desk_group' => 'DG',
        'start_time' => '0600',
        'rotation' => 'A',
        'workdays_from_file' => null,
        'workdays_computed' => 1,
    ]);

    $offFridays = [];
    foreach ($range->eachDate() as $date) {
        if ($date->isFriday() && $date->month === 3 && $offFridays === []) {
            $offFridays[] = $date->format('Y-m-d');
        }
        if ($date->isFriday() && $date->month === 10 && count($offFridays) === 1) {
            $offFridays[] = $date->format('Y-m-d');
        }

        BidLineDay::create([
            'bid_line_id' => $line->id,
            'assignment_date' => $date->format('Y-m-d'),
            'raw_cell' => in_array($date->format('Y-m-d'), $offFridays, true) ? 'x' : 'DG',
            'is_off' => in_array($date->format('Y-m-d'), $offFridays, true),
            'normalized_code' => in_array($date->format('Y-m-d'), $offFridays, true) ? null : 'DG',
        ]);
    }

    $metrics = app(LineMetricsService::class)->analyze($line->fresh());

    expect($metrics['fri_off'])->toBe(2);
    expect($metrics['sept_feb']['fri_off'])->toBe(1);
});

test('bid year range sept feb season includes february start and january end only in bid year', function () {
    $range = BidYearRange::fromBidYear(2026);

    expect($range->isInSeptFebSeason(CarbonImmutable::create(2026, 2, 1)))->toBeTrue();
    expect($range->isInSeptFebSeason(CarbonImmutable::create(2026, 9, 1)))->toBeTrue();
    expect($range->isInSeptFebSeason(CarbonImmutable::create(2027, 1, 31)))->toBeTrue();
    expect($range->isInSeptFebSeason(CarbonImmutable::create(2026, 3, 1)))->toBeFalse();
    expect($range->isInSeptFebSeason(CarbonImmutable::create(2026, 8, 31)))->toBeFalse();
    expect($range->isInSeptFebSeason(CarbonImmutable::create(2027, 2, 1)))->toBeFalse();
});
