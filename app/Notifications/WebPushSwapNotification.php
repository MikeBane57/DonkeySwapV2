<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Sent synchronously so pushes work without a queue worker (e.g. on shared hosting).
 * If you run queue:work, you can implement ShouldQueue again for background sending.
 */
class WebPushSwapNotification extends Notification
{
    public function __construct(
        public string $title,
        public string $body,
        public string $url = '/app',
        public ?string $tag = null,
        public ?int $badgeCount = null
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, Notification $notification): WebPushMessage
    {
        $data = ['url' => $this->url];
        if ($this->badgeCount !== null && $this->badgeCount >= 0) {
            $data['badgeCount'] = min(99, $this->badgeCount);
        }
        $message = (new WebPushMessage)
            ->title($this->title)
            ->body($this->body)
            ->icon(asset(\App\Models\Setting::appIconUrl()))
            ->data($data)
            ->options(['TTL' => 86400]); // 24h

        if ($this->tag !== null) {
            $message->tag($this->tag);
        }

        return $message;
    }
}
