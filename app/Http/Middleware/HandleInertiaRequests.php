<?php

namespace App\Http\Middleware;

use App\Models\AppNotification;
use App\Models\Setting;
use App\Models\SwapOffer;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $badgeCount = 0;
        $appIconUrl = Setting::appIconUrl();

        if ($user) {
            $actionRequiredCount = SwapOffer::where('status', 'pending')
                ->whereHas('swapPost', fn ($q) => $q->where('user_id', $user->id))
                ->count();
            $unreadNotificationCount = AppNotification::where('user_id', $user->id)
                ->whereNull('read_at')
                ->count();
            $badgeCount = $actionRequiredCount + $unreadNotificationCount;
        }

        $vapidPublicKey = config('webpush.vapid.public_key');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'app_icon_url' => $appIconUrl,
            'badge_count' => $badgeCount,
            'vapid_public_key' => $vapidPublicKey ?: null,
            'auth' => [
                'user' => $user ? (function () use ($user) {
                    $u = $user;
                    return [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email,
                        'email_verified_at' => $u->email_verified_at?->toIso8601String(),
                        'avatar' => $u->avatar ?? null,
                        'role' => $u->role ?? null,
                        'time_display_preference' => $u->time_display_preference ?? null,
                        'phone' => $u->phone ?? null,
                        'preferred_contact_method' => $u->preferred_contact_method ?? null,
                    ];
                })() : null,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
        ];
    }
}
