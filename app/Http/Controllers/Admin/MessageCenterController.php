<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminBannerMessage;
use App\Models\AdminNotificationBatch;
use App\Models\AppNotification;
use App\Models\User;
use App\Models\Workgroup;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

class MessageCenterController extends Controller
{
    public function index(): Response
    {
        $now = Carbon::now()->utc();

        $banners = AdminBannerMessage::with(['workgroup:id,name', 'creator:id,name', 'recipients:id,name,email', 'acknowledgements:id,name'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function (AdminBannerMessage $m) use ($now) {
                $status = $this->bannerStatus($m, $now);
                $recipients = $m->recipients->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]);
                $ackIds = $m->acknowledgements->pluck('id')->all();
                $acknowledged = $m->acknowledgements->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]);
                $not_acknowledged = $m->recipients->whereNotIn('id', $ackIds)->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values()->all();

                return [
                    'id' => $m->id,
                    'title' => $m->title,
                    'body' => $m->body,
                    'target_type' => $m->target_type,
                    'target_workgroup_id' => $m->target_workgroup_id,
                    'target_workgroup_name' => $m->workgroup?->name,
                    'created_by_name' => $m->creator?->name,
                    'created_at' => $m->created_at?->toIso8601String(),
                    'recipient_count' => $m->recipients->count(),
                    'active_at_start' => $m->active_at_start?->toIso8601String(),
                    'active_at_end' => $m->active_at_end?->toIso8601String(),
                    'status' => $status,
                    'recipients' => $recipients->values()->all(),
                    'acknowledged' => $acknowledged->values()->all(),
                    'not_acknowledged' => $not_acknowledged,
                ];
            });

        $notificationBatches = AdminNotificationBatch::with(['creator:id,name', 'notifications' => fn ($q) => $q->with('user:id,name')])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function (AdminNotificationBatch $b) use ($now) {
                $status = $this->batchStatus($b, $now);
                $read = $b->notifications->filter(fn ($n) => $n->read_at !== null)->map(fn ($n) => ['id' => $n->user_id, 'name' => $n->user?->name ?? '—'])->values()->all();
                $unread = $b->notifications->filter(fn ($n) => $n->read_at === null)->map(fn ($n) => ['id' => $n->user_id, 'name' => $n->user?->name ?? '—'])->values()->all();

                return [
                    'id' => $b->id,
                    'title' => $b->title,
                    'body' => $b->body,
                    'created_by_name' => $b->creator?->name,
                    'created_at' => $b->created_at?->toIso8601String(),
                    'recipient_count' => $b->notifications->count(),
                    'active_at_start' => $b->active_at_start?->toIso8601String(),
                    'active_at_end' => $b->active_at_end?->toIso8601String(),
                    'status' => $status,
                    'read' => $read,
                    'unread' => $unread,
                ];
            });

        $users = User::orderBy('name')->get(['id', 'name', 'email'])->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
        ]);
        $workgroups = Workgroup::orderBy('name')->get(['id', 'name'])->map(fn ($wg) => [
            'id' => $wg->id,
            'name' => $wg->name,
        ]);

        return Inertia::render('admin/message-center', [
            'banners' => $banners,
            'notificationBatches' => $notificationBatches,
            'users' => $users,
            'workgroups' => $workgroups,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'delivery' => ['required', 'string', 'in:banner,notification'],
            'target_type' => ['required', 'string', 'in:all,workgroup,individual'],
            'target_workgroup_id' => ['nullable', 'required_if:target_type,workgroup', 'exists:workgroups,id'],
            'target_user_ids' => ['nullable', 'array'],
            'target_user_ids.*' => ['integer', 'exists:users,id'],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:10000'],
            'active_at_start' => ['nullable', 'string', 'date'],
            'active_at_end' => ['nullable', 'string', 'date', 'after_or_equal:active_at_start'],
        ]);
        if ($validator->fails()) {
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $targetType = $request->input('target_type');
        $targetWorkgroupId = $request->input('target_workgroup_id');
        $targetUserIds = $request->input('target_user_ids') ?? [];
        $title = $request->input('title');
        $body = $request->input('body');
        $delivery = $request->input('delivery');
        $activeAtStart = $request->filled('active_at_start') ? Carbon::parse($request->input('active_at_start'))->utc() : null;
        $activeAtEnd = $request->filled('active_at_end') ? Carbon::parse($request->input('active_at_end'))->utc() : null;

        $recipientIds = $this->resolveRecipientIds($targetType, $targetWorkgroupId, $targetUserIds);
        if ($recipientIds === []) {
            return redirect()->back()->withErrors(['target' => 'No recipients selected.'])->withInput();
        }

        if ($delivery === 'banner') {
            $message = AdminBannerMessage::create([
                'title' => $title,
                'body' => $body,
                'target_type' => $targetType,
                'target_workgroup_id' => $targetType === 'workgroup' ? $targetWorkgroupId : null,
                'created_by' => $request->user()?->id,
                'active_at_start' => $activeAtStart,
                'active_at_end' => $activeAtEnd,
            ]);
            $message->recipients()->sync($recipientIds);

            return redirect()->back()->with('success', 'Banner message sent to '.count($recipientIds).' recipient(s). It will show on their dashboard until they acknowledge it.');
        }

        $batch = AdminNotificationBatch::create([
            'title' => $title,
            'body' => $body,
            'created_by' => $request->user()?->id,
            'active_at_start' => $activeAtStart,
            'active_at_end' => $activeAtEnd,
        ]);
        foreach ($recipientIds as $userId) {
            AppNotification::create([
                'user_id' => $userId,
                'type' => 'admin_message',
                'data' => ['title' => $title, 'message' => $body],
                'admin_notification_batch_id' => $batch->id,
            ]);
        }

        return redirect()->back()->with('success', 'Notification sent to '.count($recipientIds).' recipient(s). It will appear in their notification bell.');
    }

    public function destroyBanner(AdminBannerMessage $banner): RedirectResponse
    {
        $banner->delete();

        return redirect()->back()->with('success', 'Banner message deleted.');
    }

    public function destroyNotificationBatch(AdminNotificationBatch $batch): RedirectResponse
    {
        $batch->notifications()->delete();
        $batch->delete();

        return redirect()->back()->with('success', 'Notification batch deleted.');
    }

    /**
     * Return recent notifications for a specific user (admin view).
     */
    public function userNotifications(User $user): JsonResponse
    {
        $notifications = AppNotification::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(function (AppNotification $n) {
                return [
                    'id' => $n->id,
                    'type' => $n->type,
                    'created_at' => $n->created_at?->toIso8601String(),
                    'read_at' => $n->read_at?->toIso8601String(),
                    'title' => $n->data['title'] ?? null,
                    'message' => $n->data['message'] ?? null,
                    'data' => $n->data,
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'notifications' => $notifications,
        ]);
    }

    /**
     * Clear the app badge for a user by sending a badgeCount=0 web push.
     * Does not modify read/unread state.
     */
    public function clearBadgeForUser(User $user): JsonResponse
    {
        if (! config('webpush.vapid.public_key') || ! config('webpush.vapid.private_key')) {
            return response()->json(['ok' => false, 'message' => 'Web push is not configured.'], 400);
        }

        try {
            $user->notify(new \App\Notifications\WebPushSwapNotification(
                title: config('app.name', 'Donkey Swap'),
                body: 'Badge cleared.',
                url: url('/app'),
                tag: 'badge-clear-'.$user->id,
                badgeCount: 0,
            ));
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'message' => 'Push failed: '.$e->getMessage()], 500);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Re-send a web push notification for an existing AppNotification (without creating a new one).
     */
    public function pushNotification(AppNotification $notification): JsonResponse
    {
        if (! config('webpush.vapid.public_key') || ! config('webpush.vapid.private_key')) {
            return response()->json(['ok' => false, 'message' => 'Web push is not configured.'], 400);
        }

        $user = $notification->user;
        if (! $user) {
            return response()->json(['ok' => false, 'message' => 'Notification has no user.'], 400);
        }

        [$title, $body] = $notification->getPushTitleAndBody();
        $badgeCount = AppNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        try {
            $user->notify(new \App\Notifications\WebPushSwapNotification(
                title: $title,
                body: $body,
                url: $notification->getPushUrl(),
                tag: 'notification-'.$notification->id,
                badgeCount: $badgeCount,
            ));
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'message' => 'Push failed: '.$e->getMessage()], 500);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Delete an individual notification for a user (admin).
     */
    public function destroyNotification(AppNotification $notification): JsonResponse
    {
        $notification->delete();

        return response()->json(['ok' => true]);
    }

    private function bannerStatus(AdminBannerMessage $m, Carbon $now): string
    {
        if ($m->active_at_start && $now->lt($m->active_at_start)) {
            return 'scheduled';
        }
        if ($m->active_at_end && $now->gt($m->active_at_end)) {
            return 'expired';
        }

        return 'active';
    }

    private function batchStatus(AdminNotificationBatch $b, Carbon $now): string
    {
        if ($b->active_at_start && $now->lt($b->active_at_start)) {
            return 'scheduled';
        }
        if ($b->active_at_end && $now->gt($b->active_at_end)) {
            return 'expired';
        }

        return 'active';
    }

    private function resolveRecipientIds(string $targetType, ?string $targetWorkgroupId, array $targetUserIds): array
    {
        if ($targetType === 'all') {
            return User::pluck('id')->all();
        }
        if ($targetType === 'workgroup' && $targetWorkgroupId) {
            return User::whereHas('workgroups', fn ($q) => $q->where('workgroups.id', $targetWorkgroupId))
                ->pluck('id')
                ->all();
        }
        if ($targetType === 'individual' && $targetUserIds !== []) {
            return array_values(array_unique(array_map('intval', $targetUserIds)));
        }

        return [];
    }
}
