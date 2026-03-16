<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\ComplianceAuditLog;
use App\Models\Shift;
use App\Models\ShiftActivityLog;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use Illuminate\Support\Facades\DB;

class SwapTransactionService
{
    public function __construct(
        protected ComplianceValidator $complianceValidator
    ) {}

    /**
     * Execute a trade: swap ownership of shift A (from poster) and shift B (from offerer).
     * Validates compliance for both users, qualification for flight_follow, then performs atomic swap.
     *
     * @param  int|null  $selectedShiftId  If provided, use this shift (must be in offer's offered_shift_preference_order) instead of offer's primary.
     * @return array{success: bool, message?: string, errors?: array<string>}
     */
    public function executeTrade(int $swapPostId, int $swapOfferId, ?int $selectedShiftId = null): array
    {
        $post = SwapPost::with(['shift.workgroup', 'user', 'offers'])->findOrFail($swapPostId);
        $offer = SwapOffer::with(['offeredShift', 'offeredBy'])->where('swap_post_id', $swapPostId)->findOrFail($swapOfferId);

        if (! in_array($post->type, ['trade', 'time_trade'], true)) {
            return ['success' => false, 'message' => 'Post is not a trade or time trade post.', 'errors' => ['Invalid post type']];
        }

        if ($post->status !== 'open') {
            return ['success' => false, 'message' => 'Post is no longer open.', 'errors' => ['Post closed or cancelled']];
        }

        if ($offer->status !== 'pending') {
            return ['success' => false, 'message' => 'The offer is no longer valid.', 'errors' => ['Invalid offer state']];
        }

        $offeredShift = null;
        if ($selectedShiftId !== null) {
            $shift = Shift::with('workgroup')->find($selectedShiftId);
            if (! $shift || $shift->user_id !== $offer->offered_by_user_id) {
                return ['success' => false, 'message' => 'Invalid selected shift.', 'errors' => ['Selected shift must be one of the offered shifts']];
            }
            $order = $offer->offered_shift_preference_order ?? ($offer->offered_shift_id ? [$offer->offered_shift_id] : []);
            if (! in_array($selectedShiftId, $order, true)) {
                return ['success' => false, 'message' => 'Selected shift is not one of the offered shifts.', 'errors' => ['Invalid selection']];
            }
            $offeredShift = $shift;
        } else {
            $offeredShift = $offer->offeredShift;
        }

        if (! $offeredShift) {
            return ['success' => false, 'message' => 'No shift offered.', 'errors' => ['Missing offered shift']];
        }

        $poster = $post->user;
        $offerer = $offer->offeredBy;
        $shiftA = $post->shift;
        $shiftB = $offeredShift;

        // Flight follow: offerer must have DSP qualification in the workgroup
        if ($shiftA->workgroup->regulatory) {
            $qualified = $offerer->workgroupQualifications()
                ->where('workgroup_id', $shiftA->workgroup_id)
                ->where('code', 'DSP')
                ->exists();
            if (! $qualified) {
                ComplianceAuditLog::create([
                    'user_id' => $offerer->id,
                    'action_type' => 'trade_qualification_failed',
                    'shift_ids' => [$shiftA->id, $shiftB->id],
                    'rule_violated' => 'dsp_qualification',
                    'message' => 'User does not have DSP qualification for flight follow / regulatory workgroup',
                ]);

                return ['success' => false, 'message' => 'You do not have DSP qualification for this workgroup.', 'errors' => ['dsp_qualification']];
            }
        }

        try {
            return DB::transaction(function () use ($post, $offer, $poster, $offerer, $shiftA, $shiftB) {
                // Simulate new state: poster gets shiftB, offerer gets shiftA
                $posterShiftsAfter = $this->userShiftBlocksExcluding($poster->id, $shiftA->id);
                $posterShiftsAfter[] = [
                    'start_time_utc' => $shiftB->start_time_utc,
                    'end_time_utc' => $shiftB->end_time_utc,
                    'regulatory' => $shiftB->regulatory,
                ];
                $offererShiftsAfter = $this->userShiftBlocksExcluding($offerer->id, $shiftB->id);
                $offererShiftsAfter[] = [
                    'start_time_utc' => $shiftA->start_time_utc,
                    'end_time_utc' => $shiftA->end_time_utc,
                    'regulatory' => $shiftA->regulatory,
                ];

                $workgroup = $shiftA->workgroup;
                $maxHours = $workgroup->max_hours_per_day ?? 10;
                $restHours = $workgroup->rest_required_hours ?? 8;
                $allowDouble = $workgroup->allow_double ?? false;

                $validPoster = $this->complianceValidator->validateForUser(
                    $poster->id,
                    $posterShiftsAfter,
                    [],
                    $workgroup->id,
                    $workgroup->regulatory,
                    $maxHours,
                    $restHours,
                    $allowDouble
                );
                if (! $validPoster['valid']) {
                    DB::rollBack();
                    ComplianceAuditLog::create([
                        'user_id' => $poster->id,
                        'action_type' => 'trade_compliance_failed',
                        'shift_ids' => [$shiftA->id, $shiftB->id],
                        'rule_violated' => implode('; ', $validPoster['errors']),
                        'message' => $validPoster['errors'][0] ?? 'Compliance check failed',
                        'metadata' => ['errors' => $validPoster['errors']],
                    ]);

                    return ['success' => false, 'message' => $validPoster['errors'][0] ?? 'Compliance failed', 'errors' => $validPoster['errors']];
                }

                $validOfferer = $this->complianceValidator->validateForUser(
                    $offerer->id,
                    $offererShiftsAfter,
                    [],
                    $workgroup->id,
                    $workgroup->regulatory,
                    $maxHours,
                    $restHours,
                    $allowDouble
                );
                if (! $validOfferer['valid']) {
                    DB::rollBack();
                    ComplianceAuditLog::create([
                        'user_id' => $offerer->id,
                        'action_type' => 'trade_compliance_failed',
                        'shift_ids' => [$shiftA->id, $shiftB->id],
                        'rule_violated' => implode('; ', $validOfferer['errors']),
                        'message' => $validOfferer['errors'][0] ?? 'Compliance check failed',
                        'metadata' => ['errors' => $validOfferer['errors']],
                    ]);

                    return ['success' => false, 'message' => $validOfferer['errors'][0] ?? 'Compliance failed', 'errors' => $validOfferer['errors']];
                }

                // Atomic swap
                $shiftA->user_id = $offerer->id;
                $shiftA->save();
                $shiftB->user_id = $poster->id;
                $shiftB->save();

                ShiftActivityLog::create([
                    'shift_id' => $shiftA->id,
                    'event_type' => 'assignee_changed',
                    'metadata' => ['from_user_id' => $poster->id, 'to_user_id' => $offerer->id],
                    'user_id' => $poster->id,
                    'swap_offer_id' => $offer->id,
                ]);
                ShiftActivityLog::create([
                    'shift_id' => $shiftB->id,
                    'event_type' => 'assignee_changed',
                    'metadata' => ['from_user_id' => $offerer->id, 'to_user_id' => $poster->id],
                    'user_id' => $offerer->id,
                    'swap_offer_id' => $offer->id,
                ]);

                $post->status = 'accepted';
                $post->save();

                $offer->status = 'selected';
                $offer->save();

                // Reject other pending offers on this post
                SwapOffer::where('swap_post_id', $post->id)->where('id', '!=', $offer->id)->where('status', 'pending')->update(['status' => 'rejected']);

                // Notifications
                AppNotification::create([
                    'user_id' => $poster->id,
                    'type' => 'swap_accepted',
                    'data' => ['swap_post_id' => $post->id, 'swap_offer_id' => $offer->id, 'message' => 'Your trade was accepted.'],
                ]);
                AppNotification::create([
                    'user_id' => $offerer->id,
                    'type' => 'swap_accepted',
                    'data' => [
                        'swap_post_id' => $post->id,
                        'swap_offer_id' => $offer->id,
                        'shift_id' => $shiftA->id,
                        'message' => 'Your offer was selected.',
                    ],
                ]);

                return ['success' => true];
            });
        } catch (\Throwable $e) {
            ComplianceAuditLog::create([
                'user_id' => $poster->id,
                'action_type' => 'trade_exception',
                'shift_ids' => [$shiftA->id, $shiftB->id],
                'rule_violated' => null,
                'message' => $e->getMessage(),
                'metadata' => ['exception' => $e->getTraceAsString()],
            ]);

            return ['success' => false, 'message' => 'Transaction failed.', 'errors' => [$e->getMessage()]];
        }
    }

    /**
     * @return array<int, array{start_time_utc: \Carbon\Carbon, end_time_utc: \Carbon\Carbon, regulatory: bool}>
     */
    private function userShiftBlocksExcluding(int $userId, int $excludeShiftId): array
    {
        return Shift::where('user_id', $userId)
            ->where('id', '!=', $excludeShiftId)
            ->get()
            ->map(fn (Shift $s) => [
                'start_time_utc' => $s->start_time_utc,
                'end_time_utc' => $s->end_time_utc,
                'regulatory' => $s->regulatory,
            ])
            ->toArray();
    }
}
