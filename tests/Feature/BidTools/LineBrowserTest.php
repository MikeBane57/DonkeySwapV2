<?php

use App\Models\BidImport;
use App\Models\BidLine;
use App\Models\User;

test('line browser lists desk groups for the current import', function () {
    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => 2026,
        'file_hash' => 'line-browser-groups',
        'original_filename' => 't.csv',
        'is_current' => true,
        'meta' => [],
    ]);

    BidLine::create([
        'bid_import_id' => $import->id,
        'line_num' => '100',
        'desk_group' => 'DG',
        'start_time' => '0600',
        'rotation' => 'A',
        'workdays_from_file' => null,
        'workdays_computed' => 1,
    ]);
    BidLine::create([
        'bid_import_id' => $import->id,
        'line_num' => '200',
        'desk_group' => 'MG',
        'start_time' => '2200',
        'rotation' => 'B',
        'workdays_from_file' => null,
        'workdays_computed' => 1,
    ]);

    $this->actingAs($user)
        ->get(route('bid-tools.lines.index', ['bid_year' => 2026]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('app/bid-tools/lines')
            ->has('desk_groups', 2)
            ->where('desk_groups', ['DG', 'MG']));
});

test('authenticated user can update a bid line desk group from line browser', function () {
    $user = User::factory()->create();
    $import = BidImport::create([
        'uploaded_by_user_id' => $user->id,
        'bid_year' => 2026,
        'file_hash' => 'line-browser-update-group',
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

    $this->actingAs($user)
        ->from(route('bid-tools.lines.index'))
        ->patch(route('bid-tools.lines.desk-group', $line->id), [
            'desk_group' => 'DS',
        ])
        ->assertRedirect(route('bid-tools.lines.index'));

    expect($line->fresh()->desk_group)->toBe('DS');
});
