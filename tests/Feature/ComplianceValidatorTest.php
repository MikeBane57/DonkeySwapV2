<?php

use App\Models\Shift;
use App\Models\User;
use App\Models\Workgroup;
use App\Services\ComplianceValidator;
use Carbon\Carbon;

beforeEach(function () {
    $this->validator = new ComplianceValidator;
});

test('regulatory block: daily hours exceed max', function () {
    $user = User::factory()->create();
    $wg = Workgroup::factory()->create(['regulatory' => true, 'max_hours_per_day' => 10]);
    $day = Carbon::today()->utc()->addDay()->format('Y-m-d');

    $shifts = [
        ['start_time_utc' => "{$day}T06:00:00+00:00", 'end_time_utc' => "{$day}T12:00:00+00:00", 'regulatory' => true],
        ['start_time_utc' => "{$day}T14:00:00+00:00", 'end_time_utc' => "{$day}T20:00:00+00:00", 'regulatory' => true],
    ];
    $result = $this->validator->validateForUser($user->id, $shifts, [], $wg->id, true, 10, 8, false);
    expect($result['valid'])->toBeFalse();
    expect($result['errors'])->not->toBeEmpty();
});

test('overlap block: overlapping shifts fail', function () {
    $user = User::factory()->create();
    $base = Carbon::today()->utc()->setHour(8)->setMinute(0);

    $shifts = [
        ['start_time_utc' => $base->copy(), 'end_time_utc' => $base->copy()->addHours(8), 'regulatory' => true],
        ['start_time_utc' => $base->copy()->addHours(4), 'end_time_utc' => $base->copy()->addHours(12), 'regulatory' => true],
    ];
    $result = $this->validator->validateForUser($user->id, $shifts, [], null, true, 10, 8, false);
    expect($result['valid'])->toBeFalse();
});

test('midnight rest enforcement: less than 8 hours rest before next shift fails', function () {
    $user = User::factory()->create();
    $day1 = Carbon::today()->utc()->addDay()->format('Y-m-d');
    $day2 = Carbon::today()->utc()->addDays(2)->format('Y-m-d');

    // Shift 1 ends 16:00 day1. Shift 2 starts 23:00 day1 → rest = 7h (< 8h required).
    $shifts = [
        ['start_time_utc' => "{$day1}T06:00:00+00:00", 'end_time_utc' => "{$day1}T16:00:00+00:00", 'regulatory' => true],
        ['start_time_utc' => "{$day1}T23:00:00+00:00", 'end_time_utc' => "{$day2}T07:00:00+00:00", 'regulatory' => true],
    ];
    $result = $this->validator->validateForUser($user->id, $shifts, [], null, true, 10, 8, false);
    expect($result['valid'])->toBeFalse();
});

test('valid non-overlapping shifts with rest pass', function () {
    $user = User::factory()->create();
    $base = Carbon::today()->utc()->startOfDay();

    // Shift 1: 06:00–14:00 day1 (8h). Shift 2: 06:00–14:00 day2 (8h). Rest between = 16h. Use strings to avoid reference issues.
    $shifts = [
        ['start_time_utc' => $base->copy()->addDay()->setHour(6)->setMinute(0)->toIso8601String(), 'end_time_utc' => $base->copy()->addDay()->setHour(14)->setMinute(0)->toIso8601String(), 'regulatory' => true],
        ['start_time_utc' => $base->copy()->addDays(2)->setHour(6)->setMinute(0)->toIso8601String(), 'end_time_utc' => $base->copy()->addDays(2)->setHour(14)->setMinute(0)->toIso8601String(), 'regulatory' => true],
    ];
    $result = $this->validator->validateForUser($user->id, $shifts, [], null, true, 10, 8, false);
    expect($result['valid'])->toBeTrue();
});
