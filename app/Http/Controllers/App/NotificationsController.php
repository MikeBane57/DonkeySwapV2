<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use Inertia\Inertia;
use Inertia\Response;

class NotificationsController extends Controller
{
    /**
     * Show unread notifications (e.g. swap accepted/rejected, offers).
     * Includes post and outcome context when the notification refers to a swap post/offer.
     */
    public function index(): Response
    {
        $user = request()->user();

        try {
            AppNotification::markReadForExpiredPosts($user->id);

            $collection = AppNotification::where('user_id', $user->id)
                ->whereNull('read_at')
                ->orderByDesc('created_at')
                ->limit(50)
                ->get();

            $notifications = $collection->map(function (AppNotification $n) {
                try {
                    return $this->formatNotification($n);
                } catch (\Throwable $e) {
                    if (config('app.debug')) {
                        throw $e;
                    }
                    return null;
                }
            })->filter()->values()->all();
        } catch (\Throwable $e) {
            report($e);
            $notifications = [];
        }

        return Inertia::render('app/notifications', [
            'notifications' => $notifications,
        ]);
    }

    private function formatNotification(AppNotification $n): array
    {
        $data = $n->data ?? [];
        $message = $data['message'] ?? $this->defaultMessage($n->type);
        if ($n->type === 'admin_message') {
            $message = $data['title'] ?? 'Message from admin';
        }
        $out = [
            'id' => $n->id,
            'type' => $n->type,
            'message' => $message,
            'data' => $data,
            'created_at' => $n->created_at?->toIso8601String() ?? '',
            'post_summary' => null,
            'outcome_summary' => null,
        ];

        $postId = $data['swap_post_id'] ?? null;
        $offerId = $data['swap_offer_id'] ?? null;
        if ($postId) {
            $post = SwapPost::with(['shift', 'user'])->find($postId);
            if ($post && $post->shift) {
                $shift = $post->shift;
                $out['post_summary'] = [
                    'post_id' => $post->id,
                    'post_type' => $post->type,
                    'poster_name' => $post->user?->name ?? 'The posting user',
                    'position_name' => $shift->position_name,
                    'start_utc' => $shift->start_time_utc?->toIso8601String(),
                    'end_utc' => $shift->end_time_utc?->toIso8601String(),
                    'formatted_range' => $shift->start_time_utc
                        ? $shift->start_time_utc->format('D, M j \a\t g:i A')
                        : null,
                ];
            }
        }
        if ($offerId) {
            $offer = SwapOffer::with(['offeredBy', 'offeredShift'])->find($offerId);
            if ($offer) {
                $otherName = $offer->offeredBy?->name ?? 'Someone';
                $offeredShift = $offer->offeredShift;
                $offeredLabel = $offeredShift
                    ? $offeredShift->position_name . ' · ' . ($offeredShift->start_time_utc ? $offeredShift->start_time_utc->format('M j, g:i A') : '')
                    : 'a shift';
                $out['outcome_summary'] = [
                    'offer_id' => $offer->id,
                    'other_user_name' => $otherName,
                    'offered_shift_label' => $offeredLabel,
                ];
            }
        }

        return $out;
    }

    private function defaultMessage(string $type): string
    {
        return match ($type) {
            'swap_accepted' => 'A swap was accepted.',
            'swap_rejected' => 'An offer was declined.',
            'admin_message' => 'Message from admin',
            default => 'You have a new notification.',
        };
    }
}
