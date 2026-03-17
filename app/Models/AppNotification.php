<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppNotification extends Model
{
    protected $table = 'notifications';

    protected $fillable = ['user_id', 'type', 'data', 'read_at', 'admin_notification_batch_id'];

    public function batch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(AdminNotificationBatch::class, 'admin_notification_batch_id');
    }

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Mark as read any unread notifications that reference a swap post whose shift has ended
     * (or post is expired), so they no longer appear and cannot be acted on.
     */
    public static function markReadForExpiredPosts(int $userId): void
    {
        $now = Carbon::now()->utc();
        $unreadWithPost = static::where('user_id', $userId)
            ->whereNull('read_at')
            ->get()
            ->filter(fn (self $n) => ! empty($n->data['swap_post_id'] ?? null));

        $postIds = $unreadWithPost->map(fn (self $n) => $n->data['swap_post_id'] ?? null)->unique()->filter()->values()->all();
        if ($postIds === []) {
            return;
        }

        $expiredPostIds = SwapPost::whereIn('id', $postIds)
            ->where(function ($q) use ($now) {
                $q->where('status', 'expired')
                    ->orWhereHas('shift', fn ($q2) => $q2->where('end_time_utc', '<', $now));
            })
            ->pluck('id')
            ->all();

        $idsToMarkRead = $unreadWithPost
            ->filter(fn (self $n) => in_array($n->data['swap_post_id'] ?? null, $expiredPostIds, true))
            ->pluck('id')
            ->all();

        if ($idsToMarkRead !== []) {
            static::whereIn('id', $idsToMarkRead)->update(['read_at' => $now]);
        }
    }

    /**
     * Title and body for web push. Returns [title, body].
     * Body is contextual when possible (e.g. "Jane Doe responded to your trade post.").
     *
     * @return array{0: string, 1: string}
     */
    public function getPushTitleAndBody(): array
    {
        $data = $this->data ?? [];
        $message = $data['message'] ?? $this->defaultPushMessage($this->type);
        if ($this->type === 'admin_message') {
            $title = (string) ($data['title'] ?? 'Message');
            $body = (string) ($data['body'] ?? $data['message'] ?? $message);

            return [$title, $body];
        }
        if (in_array($this->type, ['looking_for_work_offer', 'looking_for_work_accepted', 'looking_for_work_not_selected'], true)) {
            $title = config('app.name', 'Donkey Swap');
            $body = (string) ($data['message'] ?? $this->defaultPushMessage($this->type));
            return [$title, $body];
        }
        $title = config('app.name', 'Donkey Swap');
        $body = $this->getPushBodyWithContext();

        return [$title, $body ?? $message];
    }

    /**
     * URL to open when the user clicks the push (dashboard; for new_offer includes open_offer so modal opens).
     */
    public function getPushUrl(): string
    {
        if ($this->type === 'new_offer') {
            $offerId = $this->data['swap_offer_id'] ?? null;
            if ($offerId !== null) {
                return url('/app?open_offer=' . (int) $offerId);
            }
        }
        if ($this->type === 'looking_for_work_offer') {
            return url('/app/looking-for-work');
        }
        return url('/app');
    }

    /**
     * Richer body for push banner (e.g. "Jane Doe responded to your trade post — action required.").
     */
    public function getPushBodyWithContext(): ?string
    {
        if ($this->type === 'new_offer') {
            $offerId = $this->data['swap_offer_id'] ?? null;
            if ($offerId) {
                $offer = SwapOffer::with(['offeredBy', 'swapPost'])->find($offerId);
                if ($offer && $offer->offeredBy && $offer->swapPost) {
                    $name = $offer->offeredBy->name ?? 'Someone';
                    $postType = match ($offer->swapPost->type ?? '') {
                        'trade' => 'trade',
                        'time_trade' => 'time trade',
                        'cash' => 'giveaway',
                        'flight_follow' => 'flight follow',
                        default => 'post',
                    };

                    return "{$name} responded to your {$postType} post — action required.";
                }
            }
        }
        if ($this->type === 'swap_accepted') {
            $shiftLabel = $this->getShiftDateLabelForPush();
            if ($shiftLabel !== null) {
                return "Your response for {$shiftLabel} was accepted.";
            }
            return 'Your response was accepted.';
        }
        if ($this->type === 'swap_rejected') {
            $shiftLabel = $this->getShiftDateLabelForPush();
            if ($shiftLabel !== null) {
                return "Your offer for {$shiftLabel} was declined.";
            }
            return 'Your offer was declined.';
        }

        return null;
    }

    /**
     * Short label for push body: "Dec 15 shift" or "shift on Dec 15" from notification's swap_post_id.
     */
    private function getShiftDateLabelForPush(): ?string
    {
        $postId = $this->data['swap_post_id'] ?? null;
        if (! $postId) {
            return null;
        }
        $post = SwapPost::with('shift')->find($postId);
        if (! $post?->shift) {
            return null;
        }
        $start = $post->shift->start_time_utc;
        if ($start instanceof \Carbon\Carbon) {
            return 'shift on ' . $start->format('M j');
        }
        if (is_string($start)) {
            return 'shift on ' . \Carbon\Carbon::parse($start)->format('M j');
        }
        return null;
    }

    private function defaultPushMessage(string $type): string
    {
        return match ($type) {
            'swap_accepted' => 'Your response was accepted.',
            'swap_rejected' => 'Your offer was declined.',
            'new_offer' => 'Someone responded to your post — action required.',
            'admin_message' => 'Message from admin',
            'looking_for_work_offer' => 'Someone offered a shift on your looking-for-work post.',
            'looking_for_work_accepted' => 'Your offer was accepted. The shift has been transferred to you.',
            'looking_for_work_not_selected' => 'Another offer was accepted on the post you responded to.',
            default => 'You have a new notification.',
        };
    }
}
