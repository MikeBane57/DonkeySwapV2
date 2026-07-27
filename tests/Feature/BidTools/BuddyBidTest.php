<?php

use App\Models\BidLine;
use App\Models\BuddyBidDayAssignment;
use App\Models\BuddyBidParticipant;
use App\Models\BuddyBidPlan;
use App\Models\User;
use App\Services\BidTools\BidLineCsvImportService;
use App\Services\BidTools\BidYearRange;
use App\Services\BidTools\BuddyBidCalendarService;

function writeBuddyBidOverlapCsv(int $bidYear): string
{
    $range = BidYearRange::fromBidYear($bidYear);
    $path = tempnam(sys_get_temp_dir(), 'buddybid').'.csv';
    $fh = fopen($path, 'wb');
    $headers = ['Line Num', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';
    fputcsv($fh, $headers);

    foreach ([['601', 'DG', '0600'], ['602', 'AG', '1500']] as [$num, $group, $start]) {
        $row = [$num, $group, $start, 'A'];
        foreach ($range->eachDate() as $d) {
            $row[] = $group;
        }
        $row[] = '0';
        fputcsv($fh, $row);
    }

    fclose($fh);

    return $path;
}

function writeBuddyBidTrainingDayCsv(int $bidYear): string
{
    $range = BidYearRange::fromBidYear($bidYear);
    $path = tempnam(sys_get_temp_dir(), 'buddybid').'.csv';
    $fh = fopen($path, 'wb');
    $headers = ['Line Num', 'Group', 'Start Time', 'Rotation'];
    foreach ($range->eachDate() as $d) {
        $headers[] = $d->format('j-M-y');
    }
    $headers[] = 'workdays';
    fputcsv($fh, $headers);

    $trainingDate = $range->eachDate()[0]->format('j-M-y');

    foreach ([['601', 'DG', '0600'], ['602', 'AG', '1500']] as [$num, $group, $start]) {
        $row = [$num, $group, $start, 'A'];
        foreach ($range->eachDate() as $d) {
            $cell = $d->format('j-M-y') === $trainingDate && $num === '601' ? 'TAM' : $group;
            $row[] = $cell;
        }
        $row[] = '0';
        fputcsv($fh, $row);
    }

    fclose($fh);

    return $path;
}

test('buddy bids create page loads', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('bid-tools.buddy-bids.create'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('app/bid-tools/buddy-bids/create'));
});

test('buddy bids create path is not captured by show route', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/app/bid-tools/buddy-bids/create')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('app/bid-tools/buddy-bids/create'));
});

test('user can create buddy bid plan and assign overlap doubles', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeBuddyBidOverlapCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'buddy-lines.csv',
        $user->id,
        $bidYear,
        null,
        'Buddy import',
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();
    expect($lines)->toHaveCount(2);

    $this->actingAs($user)
        ->post(route('bid-tools.buddy-bids.store'), [
            'bid_import_id' => $import->id,
            'name' => 'Smith / Jones',
        ])
        ->assertRedirect();

    $plan = BuddyBidPlan::query()->where('user_id', $user->id)->firstOrFail();
    expect($plan->participants)->toHaveCount(2);

    $participants = $plan->participants()->orderBy('slot')->get();

    $this->actingAs($user)
        ->put(route('bid-tools.buddy-bids.participants.update', $plan->id), [
            'participants' => [
                [
                    'id' => $participants[0]->id,
                    'display_name' => 'Smith',
                    'bid_line_id' => $lines[0]->id,
                    'profile' => [
                        'vacation_dates' => ['2026-03-15'],
                        'pull_dates' => [],
                    ],
                ],
                [
                    'id' => $participants[1]->id,
                    'display_name' => 'Jones',
                    'bid_line_id' => $lines[1]->id,
                    'profile' => [
                        'vacation_dates' => [],
                        'pull_dates' => ['2026-04-01'],
                    ],
                ],
            ],
        ])
        ->assertRedirect(route('bid-tools.buddy-bids.show', $plan->id));

    $plan->refresh()->load('participants.line', 'import');
    $calendar = app(BuddyBidCalendarService::class)->build($plan);

    expect($calendar['lines_can_double'])->toBeTrue()
        ->and($calendar['shift_pairing'])->toBe('am_pm');

    $firstOverlap = collect($calendar['months'])
        ->flatMap(fn (array $month) => $month['days'])
        ->first(fn (array $day) => $day['is_compatible_overlap']);

    expect($firstOverlap)->not->toBeNull();

    $this->actingAs($user)
        ->put(route('bid-tools.buddy-bids.assignments.update', $plan->id), [
            'assignments' => [
                [
                    'date' => $firstOverlap['date'],
                    'double_participant_id' => $participants[0]->id,
                ],
            ],
        ])
        ->assertRedirect(route('bid-tools.buddy-bids.show', $plan->id));

    expect(
        BuddyBidDayAssignment::query()
            ->where('buddy_bid_plan_id', $plan->id)
            ->whereDate('assignment_date', $firstOverlap['date'])
            ->value('double_participant_id'),
    )->toBe($participants[0]->id);

    $plan->refresh()->load('participants.line', 'dayAssignments', 'import');
    $after = app(BuddyBidCalendarService::class)->build($plan);

    expect($after['summary'][0]['doubles'])->toBe(1)
        ->and($after['summary'][1]['buddy_offs'])->toBe(1);
});

test('training days are excluded from double overlap and shown like pulls', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeBuddyBidTrainingDayCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'buddy-training.csv',
        $user->id,
        $bidYear,
        null,
        'Buddy training import',
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();

    $plan = BuddyBidPlan::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Training test',
    ]);

    foreach ([
        ['slot' => 1, 'display_name' => 'Smith'],
        ['slot' => 2, 'display_name' => 'Jones'],
    ] as $participant) {
        BuddyBidParticipant::create([
            'buddy_bid_plan_id' => $plan->id,
            'slot' => $participant['slot'],
            'display_name' => $participant['display_name'],
            'bid_line_id' => $lines[$participant['slot'] - 1]->id,
            'profile' => app(BuddyBidCalendarService::class)->defaultProfile(),
        ]);
    }

    $plan->refresh()->load('participants.line', 'import');
    $calendar = app(BuddyBidCalendarService::class)->build($plan);

    $trainingDay = collect($calendar['months'])
        ->flatMap(fn (array $month) => $month['days'])
        ->first(fn (array $day) => collect($day['participants'])->contains(
            fn (array $cell) => $cell['status'] === 'training',
        ));

    expect($trainingDay)->not->toBeNull()
        ->and($trainingDay['is_compatible_overlap'])->toBeFalse();

    $trainingCell = collect($trainingDay['participants'])->firstWhere('status', 'training');
    expect($trainingCell)->not->toBeNull()
        ->and($calendar['summary'][0]['training_on_work'])->toBe(1);
});

test('overlap assignments can be saved as json without full page reload', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeBuddyBidOverlapCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'buddy-lines.csv',
        $user->id,
        $bidYear,
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();

    $plan = BuddyBidPlan::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'JSON save test',
    ]);

    $participants = [];
    foreach ([
        ['slot' => 1, 'display_name' => 'Smith'],
        ['slot' => 2, 'display_name' => 'Jones'],
    ] as $index => $participant) {
        $participants[] = BuddyBidParticipant::create([
            'buddy_bid_plan_id' => $plan->id,
            'slot' => $participant['slot'],
            'display_name' => $participant['display_name'],
            'bid_line_id' => $lines[$index]->id,
            'profile' => app(BuddyBidCalendarService::class)->defaultProfile(),
        ]);
    }

    $calendar = app(BuddyBidCalendarService::class)->build($plan->refresh()->load('participants.line', 'import'));
    $firstOverlap = collect($calendar['months'])
        ->flatMap(fn (array $month) => $month['days'])
        ->first(fn (array $day) => $day['is_compatible_overlap']);

    $this->actingAs($user)
        ->putJson(route('bid-tools.buddy-bids.assignments.update', $plan->id), [
            'assignments' => [
                [
                    'date' => $firstOverlap['date'],
                    'double_participant_id' => $participants[0]->id,
                ],
            ],
        ])
        ->assertOk()
        ->assertJson(['saved' => true]);
});

test('buddy bids routes are gated by feature flag', function () {
    config(['features.bid_tools' => false]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('bid-tools.buddy-bids.index'))
        ->assertNotFound();
});

test('user cannot access another users buddy bid plan', function () {
    config(['features.bid_tools' => true]);

    $owner = User::factory()->create();
    $other = User::factory()->create();
    $bidYear = 2026;
    $path = writeMinimalBidCsv($bidYear);
    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'lines.csv',
        $owner->id,
        $bidYear,
    )['import'];
    @unlink($path);

    $plan = BuddyBidPlan::create([
        'user_id' => $owner->id,
        'bid_import_id' => $import->id,
        'name' => 'Private plan',
    ]);

    $this->actingAs($other)
        ->get(route('bid-tools.buddy-bids.show', $plan->id))
        ->assertNotFound();
});

test('user can reset overlap assignments and save snapshots for comparison', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $bidYear = 2026;
    $path = writeBuddyBidOverlapCsv($bidYear);

    $import = app(BidLineCsvImportService::class)->importFromPath(
        $path,
        'buddy-lines.csv',
        $user->id,
        $bidYear,
    )['import'];

    @unlink($path);

    $lines = BidLine::query()->where('bid_import_id', $import->id)->orderBy('line_num')->get();

    $plan = BuddyBidPlan::create([
        'user_id' => $user->id,
        'bid_import_id' => $import->id,
        'name' => 'Snapshot test',
    ]);

    $participants = [];
    foreach ([
        ['slot' => 1, 'display_name' => 'Smith'],
        ['slot' => 2, 'display_name' => 'Jones'],
    ] as $index => $participant) {
        $participants[] = BuddyBidParticipant::create([
            'buddy_bid_plan_id' => $plan->id,
            'slot' => $participant['slot'],
            'display_name' => $participant['display_name'],
            'bid_line_id' => $lines[$index]->id,
            'profile' => app(BuddyBidCalendarService::class)->defaultProfile(),
        ]);
    }

    $calendar = app(BuddyBidCalendarService::class)->build($plan->refresh()->load('participants.line', 'import'));
    $overlapDays = collect($calendar['months'])
        ->flatMap(fn (array $month) => $month['days'])
        ->filter(fn (array $day) => $day['is_compatible_overlap'])
        ->values();

    $firstOverlap = $overlapDays->first();
    $secondOverlap = $overlapDays->skip(1)->first();

    $this->actingAs($user)
        ->put(route('bid-tools.buddy-bids.assignments.update', $plan->id), [
            'assignments' => [
                [
                    'date' => $firstOverlap['date'],
                    'double_participant_id' => $participants[0]->id,
                ],
                [
                    'date' => $secondOverlap['date'],
                    'double_participant_id' => $participants[1]->id,
                ],
            ],
        ])
        ->assertRedirect();

    expect(BuddyBidDayAssignment::query()->where('buddy_bid_plan_id', $plan->id)->count())->toBe(2);

    $this->actingAs($user)
        ->post(route('bid-tools.buddy-bids.snapshots.store', $plan->id), [
            'name' => 'Option A',
        ])
        ->assertRedirect(route('bid-tools.buddy-bids.show', $plan->id));

    $snapshot = $plan->snapshots()->first();
    expect($snapshot)->not->toBeNull()
        ->and($snapshot->name)->toBe('Option A')
        ->and($snapshot->assignments)->toHaveKey($firstOverlap['date']);

    $this->actingAs($user)
        ->deleteJson(route('bid-tools.buddy-bids.assignments.reset', $plan->id))
        ->assertOk()
        ->assertJson(['reset' => true]);

    expect(BuddyBidDayAssignment::query()->where('buddy_bid_plan_id', $plan->id)->count())->toBe(0);

    $this->actingAs($user)
        ->put(route('bid-tools.buddy-bids.assignments.update', $plan->id), [
            'assignments' => [
                [
                    'date' => $firstOverlap['date'],
                    'double_participant_id' => $participants[1]->id,
                ],
            ],
        ])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('bid-tools.buddy-bids.snapshots.store', $plan->id), [
            'name' => 'Option B',
        ])
        ->assertRedirect();

    $secondSnapshot = $plan->snapshots()->orderByDesc('id')->first();

    $this->actingAs($user)
        ->post(route('bid-tools.buddy-bids.compare.run', $plan->id), [
            'include_current' => true,
            'snapshot_ids' => [$snapshot->id, $secondSnapshot->id],
        ])
        ->assertRedirect(route('bid-tools.buddy-bids.compare.show', $plan->id));

    $this->actingAs($user)
        ->get(route('bid-tools.buddy-bids.compare.show', $plan->id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/buddy-bids/compare')
            ->has('comparison.versions', 3)
            ->has('comparison.pairwise_diffs'));

    $this->actingAs($user)
        ->post(route('bid-tools.buddy-bids.snapshots.restore', [
            'buddyBid' => $plan->id,
            'snapshot' => $snapshot->id,
        ]))
        ->assertRedirect(route('bid-tools.buddy-bids.show', $plan->id));

    expect(BuddyBidDayAssignment::query()
        ->where('buddy_bid_plan_id', $plan->id)
        ->where('double_participant_id', $participants[0]->id)
        ->whereDate('assignment_date', $firstOverlap['date'])
        ->exists())->toBeTrue();
});
