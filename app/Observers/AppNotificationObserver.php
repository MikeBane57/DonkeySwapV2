<?php

namespace App\Observers;

use App\Models\AppNotification;
use App\Notifications\WebPushSwapNotification;
use Illuminate\Support\Facades\Log;

class AppNotificationObserver
{
    public function created(AppNotification $notification): void
    {
        if (! config('webpush.vapid.public_key') || ! config('webpush.vapid.private_key')) {
            return;
        }

        $user = $notification->user;
        if (! $user) {
            return;
        }

        try {
            [$title, $body] = $notification->getPushTitleAndBody();
            $badgeCount = $this->getBadgeCountForUser($user->id);
            $user->notify(new WebPushSwapNotification(
                title: $title,
                body: $body,
                url: $notification->getPushUrl(),
                tag: 'swap-'.$notification->id,
                badgeCount: $badgeCount
            ));
        } catch (\Throwable $e) {
            Log::warning('Web push failed for notification '.$notification->id.': '.$e->getMessage());
        }
    }

    private function getBadgeCountForUser(int $userId): int
    {
        return AppNotification::where('user_id', $userId)
            ->whereNull('read_at')
            ->count();
    }
}
