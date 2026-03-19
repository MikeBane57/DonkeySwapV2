<?php

use App\Models\Shift;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use App\Models\User;
use App\Models\Workgroup;
use App\Models\WorkgroupQualification;
use App\Services\ComplianceValidator;
use App\Services\SwapTransactionService;
use Carbon\Carbon;

test('trade atomic swap: ownership exchanges and post closed', function () {
    $validator = new ComplianceValidator;
    $service = new SwapTransactionService($validator);

    $wg = Workgroup::factory()->create(['allow_double' => false]);
    $userA = User::factory()->create();
    $userB = User::factory()->create();
    $userA->workgroups()->attach($wg->id);
    $userB->workgroups()->attach($wg->id);

    $startA = Carbon::today()->utc()->addDays(1)->setHour(8)->setMinute(0);
    $endA = $startA->copy()->addHours(8);
    $startB = Carbon::today()->utc()->addDays(2)->setHour(8)->setMinute(0);
    $endB = $startB->copy()->addHours(8);

    $shiftA = Shift::create([
        'user_id' => $userA->id,
        'workgroup_id' => $wg->id,
        'position_name' => 'Pos A',
        'start_time_utc' => $startA,
        'end_time_utc' => $endA,
        'regulatory' => false,
    ]);
    $shiftB = Shift::create([
        'user_id' => $userB->id,
        'workgroup_id' => $wg->id,
        'position_name' => 'Pos B',
        'start_time_utc' => $startB,
        'end_time_utc' => $endB,
        'regulatory' => false,
    ]);

    $post = SwapPost::create([
        'shift_id' => $shiftA->id,
        'user_id' => $userA->id,
        'type' => 'trade',
        'status' => 'open',
    ]);
    $offer = SwapOffer::create([
        'swap_post_id' => $post->id,
        'offered_by_user_id' => $userB->id,
        'offered_shift_id' => $shiftB->id,
        'status' => 'pending',
    ]);

    $result = $service->executeTrade($post->id, $offer->id);

    expect($result['success'])->toBeTrue();
    expect($shiftA->fresh()->user_id)->toBe($userB->id);
    expect($shiftB->fresh()->user_id)->toBe($userA->id);
    expect($post->fresh()->status)->toBe('accepted');
    expect($offer->fresh()->status)->toBe('selected');
});

test('flight follow qualification block: non-qualified user cannot accept', function () {
    $validator = new ComplianceValidator;
    $service = new SwapTransactionService($validator);

    $wg = Workgroup::factory()->create();
    $dsp = WorkgroupQualification::create(['workgroup_id' => $wg->id, 'code' => 'DSP', 'label' => 'DSP', 'sort_order' => 0]);
    $userA = User::factory()->create();
    $userB = User::factory()->create();
    $userA->workgroups()->attach($wg->id);
    $userB->workgroups()->attach($wg->id);
    $userA->workgroupQualifications()->attach($dsp->id);

    $startA = Carbon::today()->utc()->addDays(1)->setHour(8)->setMinute(0);
    $endA = $startA->copy()->addHours(8);
    $startB = Carbon::today()->utc()->addDays(2)->setHour(8)->setMinute(0);
    $endB = $startB->copy()->addHours(8);

    $shiftA = Shift::create([
        'user_id' => $userA->id,
        'workgroup_id' => $wg->id,
        'position_name' => 'Pos A',
        'start_time_utc' => $startA,
        'end_time_utc' => $endA,
        'regulatory' => true,
    ]);
    $shiftB = Shift::create([
        'user_id' => $userB->id,
        'workgroup_id' => $wg->id,
        'position_name' => 'Pos B',
        'start_time_utc' => $startB,
        'end_time_utc' => $endB,
        'regulatory' => true,
    ]);

    $post = SwapPost::create([
        'shift_id' => $shiftA->id,
        'user_id' => $userA->id,
        'type' => 'trade',
        'status' => 'open',
    ]);
    $offer = SwapOffer::create([
        'swap_post_id' => $post->id,
        'offered_by_user_id' => $userB->id,
        'offered_shift_id' => $shiftB->id,
        'status' => 'pending',
    ]);

    $result = $service->executeTrade($post->id, $offer->id);

    expect($result['success'])->toBeFalse();
    expect($shiftA->fresh()->user_id)->toBe($userA->id);
    expect($shiftB->fresh()->user_id)->toBe($userB->id);
});
