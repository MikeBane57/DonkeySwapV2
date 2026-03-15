<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class WebPushSwapNotification extends Notification implements ShouldQueue
{
    use Queueable;

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
