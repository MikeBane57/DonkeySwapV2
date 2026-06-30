<?php

use App\Models\BidLine;
use App\Models\BidLineDay;
use App\Models\BidScenario;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\LineShiftClassifier;
use App\Services\BidTools\ScenarioScoreService;
use App\Services\BidTools\StartTimeNormalizer;
use Carbon\CarbonImmutable;

function shiftClassifier(): LineShiftClassifier
{
    return new LineShiftClassifier(new StartTimeNormalizer);
}

function makeShiftLine(
    array $workCodes,
    string $deskGroup = 'DG',
    string $startTime = '0600',
): BidLine {
    $line = new BidLine([
        'desk_group' => $deskGroup,
        'start_time' => $startTime,
    ]);
    $line->setRelation('days', collect($workCodes)->map(function (array $entry, int $idx) {
        $day = new BidLineDay([
            'assignment_date' => CarbonImmutable::create(2026, 3, 1)->addDays($idx),
            'raw_cell' => $entry['raw'] ?? $entry['code'],
            'is_off' => $entry['off'] ?? false,
            'normalized_code' => ($entry['off'] ?? false) ? null : strtoupper($entry['code']),
        ]);

        return $day;
    }));

    return $line;
}

test('classifies start times into am pm and mid buckets', function () {
    $classifier = shiftClassifier();

    expect($classifier->startShiftBucket('0600'))->toBe('am');
    expect($classifier->startShiftBucket('AM-MIX 0600 0700'))->toBe('am');
    expect($classifier->startShiftBucket('1500'))->toBe('pm');
    expect($classifier->startShiftBucket('PM-MIX'))->toBe('pm');
    expect($classifier->startShiftBucket('2200'))->toBe('mid');
    expect($classifier->startShiftBucket('MID-MIX'))->toBe('mid');
});

test('relief lines classify as relief regardless of start time', function () {
    $classifier = shiftClassifier();

    $relief = makeShiftLine([
        ['code' => 'RELIEF-S4'],
    ], deskGroup: 'DG', startTime: '0600');

    expect($classifier->classify($relief))->toBe(LineShiftClassifier::SHIFT_RELIEF);
});

test('non relief lines classify from clock start time', function () {
    $classifier = shiftClassifier();

    $am = makeShiftLine([], deskGroup: 'DG', startTime: '0600');
    $pm = makeShiftLine([], deskGroup: 'AG', startTime: '1500');
    $mid = makeShiftLine([], deskGroup: 'MG', startTime: '2200');

    expect($classifier->classify($am))->toBe('am');
    expect($classifier->classify($pm))->toBe('pm');
    expect($classifier->classify($mid))->toBe('mid');
});

test('strict shift order ranks am before pm before mid before relief', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeStartTimeHolidayTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'shift-order.csv',
        $user->id,
        $bidYear,
        null,
        'Shift order import',
    )['import'];

    @unlink($path);

    $amLine = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->where('line_num', '551')
        ->firstOrFail();
    $pmLine = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->where('line_num', '552')
        ->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Strict shift order',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 100,
            'personal' => 0,
            'start_time' => 0,
            'desk' => 0,
            'vacation_penalty' => 0,
            'sort_mode' => 'weighted',
            'strict_shift_order' => true,
            'criteria_order' => ['holiday', 'personal', 'start_time', 'desk'],
        ],
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => [],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$pmLine->id, $amLine->id],
    );

    expect($scores)->toHaveCount(2);
    expect($scores[0]['bid_line_id'])->toBe($amLine->id);
    expect($scores[1]['bid_line_id'])->toBe($pmLine->id);
    expect($scores[0]['total'])->toBeLessThan($scores[1]['total']);
});

test('without strict shift order holidays can outrank shift class', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeStartTimeHolidayTradeoffCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'shift-order-off.csv',
        $user->id,
        $bidYear,
        null,
        'Shift order off import',
    )['import'];

    @unlink($path);

    $amLine = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->where('line_num', '551')
        ->firstOrFail();
    $pmLine = BidLine::query()
        ->where('bid_import_id', $import->id)
        ->where('line_num', '552')
        ->firstOrFail();

    $scenario = BidScenario::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Weighted holidays win',
        'vacation_bank' => 10,
        'weights' => [
            'holiday' => 100,
            'personal' => 0,
            'start_time' => 0,
            'desk' => 0,
            'vacation_penalty' => 0,
            'sort_mode' => 'weighted',
            'strict_shift_order' => false,
            'criteria_order' => ['holiday', 'personal', 'start_time', 'desk'],
        ],
        'holiday_rank' => app(ScenarioScoreService::class)->defaultHolidayEntries($bidYear),
        'desk_rank' => [],
        'start_time_rank' => [],
        'personal_dates' => [],
    ]);

    $scores = app(ScenarioScoreService::class)->scoreLines(
        $scenario,
        [$amLine->id, $pmLine->id],
    );

    expect($scores[0]['bid_line_id'])->toBe($pmLine->id);
});
