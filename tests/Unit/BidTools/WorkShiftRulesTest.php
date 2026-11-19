<?php

use App\Models\BidLine;
use Tests\TestCase;

uses(TestCase::class);
use App\Models\BidLineDay;
use App\Services\BidTools\BuddyBidDoubleCompatibility;
use App\Services\BidTools\WorkShiftRules;
use Carbon\Carbon;

test('desk titles strip A/D from G R and S desks', function () {
    $rules = app(WorkShiftRules::class);

    expect($rules->calendarDeskTitle('AG4', null))->toBe('G4')
        ->and($rules->calendarDeskTitle('DR2', null))->toBe('R2')
        ->and($rules->calendarDeskTitle('DS5', null))->toBe('S5')
        ->and($rules->calendarDeskTitle('MG1', null))->toBe('MG1');
});

test('s5 and s6 map to 0700 and 1500 starts', function () {
    $rules = app(WorkShiftRules::class);

    expect($rules->workStartFromDayCode('DS5', '0600', 'DS'))->toBe('0700')
        ->and($rules->workStartFromDayCode('AS6', '1400', 'AS'))->toBe('1500')
        ->and($rules->workStartFromDayCode('DG1', '0600', 'DG'))->toBe('0600')
        ->and($rules->workStartFromDayCode('AR1', '1400', 'AS/AR'))->toBe('1500')
        ->and($rules->workStartFromDayCode('MS2', '2200', 'MS'))->toBe('2200');
});

test('dxx is excluded from calendar work', function () {
    $rules = app(WorkShiftRules::class);

    expect($rules->isNonWorkCalendarCode('DXX'))->toBeTrue()
        ->and($rules->workStartFromDayCode('DXX', '0600', 'Relief'))->toBeNull();
});

test('rfs relief counts as work without a calendar start time', function () {
    $rules = app(WorkShiftRules::class);

    expect($rules->isReliefWorkCode('RFS1'))->toBeTrue()
        ->and($rules->isReliefWorkCode('DAY RELIEF'))->toBeTrue()
        ->and($rules->isNonWorkCalendarCode('RFS1'))->toBeFalse()
        ->and($rules->workStartFromDayCode('RFS1', '0600', 'DG'))->toBeNull();
});

test('buddy overlap allows pm plus mid when overlap is at most 30 minutes', function () {
    $rules = app(WorkShiftRules::class);
    $compat = app(BuddyBidDoubleCompatibility::class);

    expect($rules->shiftsCanBuddyDouble('1400', 510, '2200', 480))->toBeTrue()
        ->and($rules->shiftsCanBuddyDouble('0700', 510, '1400', 510))->toBeFalse()
        ->and($rules->shiftsCanBuddyDouble('0700', 510, '1500', 510))->toBeTrue()
        ->and($rules->shiftsCanBuddyDouble('0600', 510, '1500', 510))->toBeTrue()
        ->and($rules->shiftsCanBuddyDouble('1500', 510, '2200', 480))->toBeFalse();

    $lineS6 = makeLineWithCodes('AS', '1500', ['AS6']);
    $lineS2 = makeLineWithCodes('AS', '1400', ['AS2']);
    $lineS5 = makeLineWithCodes('DS', '0600', ['DS5']);
    $lineMs = makeLineWithCodes('MS', '2200', ['MS2']);
    $lineMg = makeLineWithCodes('MG', '2200', ['MG1']);

    expect($compat->linesCanDouble($lineS6, $lineS2))->toBeFalse()
        ->and($compat->linesCanDouble($lineS6, $lineS5))->toBeTrue()
        ->and($compat->linesCanDouble($lineS6, $lineMg))->toBeFalse()
        ->and($compat->linesCanDouble($lineMs, makeLineWithCodes('AS', '1400', ['AS1'])))->toBeTrue();
});

/**
 * @param  list<string>  $codes
 */
function makeLineWithCodes(string $group, string $start, array $codes): BidLine
{
    $line = BidLine::make([
        'desk_group' => $group,
        'start_time' => $start,
        'line_num' => '999',
    ]);
    $line->setRelation(
        'days',
        collect($codes)->map(function (string $code, int $i) {
            return BidLineDay::make([
                'assignment_date' => Carbon::parse('2027-03-'.($i + 1)),
                'is_off' => false,
                'normalized_code' => $code,
                'raw_cell' => $code,
            ]);
        }),
    );

    return $line;
}
