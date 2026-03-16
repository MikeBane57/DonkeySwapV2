<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\ShiftActivityLog;
use App\Models\SwapOffer;
use App\Services\SwapTransactionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfferController extends Controller
{
    public function __construct(
        protected SwapTransactionService $swapTransaction
    ) {}

    /**
     * Accept a pending offer on one of the authenticated user's posts.
     * For trade/time_trade: executes the swap. For cash/flight_follow: marks offer selected and closes post.
     */
    public function accept(Request $request, SwapOffer $offer): JsonResponse
    {
        $user = $request->user();
        $offer->load(['swapPost.shift', 'offeredBy', 'offeredShift']);
        $post = $offer->swapPost;

        if (! $post || $post->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($offer->status !== 'pending') {
            return response()->json(['message' => 'The offer is no longer valid.'], 422);
        }

        if (in_array($post->type, ['trade', 'time_trade'], true)) {
            $selectedShiftId = $request->input('selected_shift_id');
            if ($selectedShiftId !== null) {
                $selectedShiftId = (int) $selectedShiftId;
                $order = $offer->offered_shift_preference_order ?? ($offer->offered_shift_id ? [$offer->offered_shift_id] : []);
                if (! in_array($selectedShiftId, $order, true)) {
                    return response()->json(['message' => 'Selected shift is not one of the offered shifts.'], 422);
                }
            }
            $result = $this->swapTransaction->executeTrade($post->id, $offer->id, $selectedShiftId);
            if (! ($result['success'] ?? false)) {
                return response()->json([
                    'message' => $result['message'] ?? 'Transaction failed.',
                    'errors' => $result['errors'] ?? [],
                ], 422);
            }
            $this->markNewOfferNotificationReadForOffer($user->id, $offer->id);
            return response()->json(['ok' => true, 'message' => 'Trade accepted. Shifts have been swapped.']);
        }

        // Cash (giveaway) or flight_follow: transfer shift to responder, close post, reject other offers
        $shift = $post->shift;
        $posterUserId = $post->user_id;

        ShiftActivityLog::create([
            'shift_id' => $shift->id,
            'event_type' => 'assignee_changed',
            'metadata' => ['from_user_id' => $posterUserId, 'to_user_id' => $offer->offered_by_user_id],
            'user_id' => $posterUserId,
            'swap_post_id' => $post->id,
            'swap_offer_id' => $offer->id,
        ]);

        $shift->user_id = $offer->offered_by_user_id;
        $shift->save();

        $offer->status = 'selected';
        $offer->save();
        $post->status = 'accepted';
        $post->save();
        SwapOffer::where('swap_post_id', $post->id)->where('id', '!=', $offer->id)->where('status', 'pending')->update(['status' => 'rejected']);

        AppNotification::create([
            'user_id' => $offer->offered_by_user_id,
            'type' => 'swap_accepted',
            'data' => [
                'swap_post_id' => $post->id,
                'swap_offer_id' => $offer->id,
                'shift_id' => $shift->id,
                'message' => 'Your response was accepted.',
            ],
        ]);

        $this->markNewOfferNotificationReadForOffer($user->id, $offer->id);
        return response()->json(['ok' => true, 'message' => 'Response accepted.']);
    }

    /**
     * Reject a pending offer on one of the authenticated user's posts.
     */
    public function reject(Request $request, SwapOffer $offer): JsonResponse
    {
        $user = $request->user();
        $offer->load('swapPost');

        if (! $offer->swapPost || $offer->swapPost->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($offer->status !== 'pending') {
            return response()->json(['message' => 'The offer is no longer valid.'], 422);
        }

        $offer->status = 'rejected';
        $offer->save();

        AppNotification::create([
            'user_id' => $offer->offered_by_user_id,
            'type' => 'swap_rejected',
            'data' => ['swap_post_id' => $offer->swap_post_id, 'swap_offer_id' => $offer->id, 'message' => 'Your offer was declined.'],
        ]);

        $this->markNewOfferNotificationReadForOffer($user->id, $offer->id);
        return response()->json(['ok' => true, 'message' => 'Offer declined.']);
    }

    /**
     * Withdraw (cancel) the current user's own pending offer.
     */
    public function withdraw(Request $request, SwapOffer $offer): JsonResponse
    {
        $user = $request->user();

        if ($offer->offered_by_user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($offer->status !== 'pending') {
            return response()->json(['message' => 'Offer already processed.'], 422);
        }

        $offer->status = 'withdrawn';
        $offer->save();

        return response()->json(['ok' => true, 'message' => 'Response cancelled.']);
    }

    /**
     * When the poster accepts or rejects an offer, mark their "new_offer" notification
     * for that offer as read so the badge count drops and they don't see a stale badge.
     */
    private function markNewOfferNotificationReadForOffer(int $posterUserId, int $offerId): void
    {
        AppNotification::where('user_id', $posterUserId)
            ->where('type', 'new_offer')
            ->where('data->swap_offer_id', $offerId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }
}
