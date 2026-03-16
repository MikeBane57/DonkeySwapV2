<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    /**
     * Return unread count and latest 10 unread notifications for polling.
     */
    public function unread(Request $request): JsonResponse
    {
        $user = $request->user();
        AppNotification::markReadForExpiredPosts($user->id);

        $query = AppNotification::where('user_id', $user->id)->whereNull('read_at');
        $count = $query->count();
        $notifications = $query->orderByDesc('created_at')->limit(10)->get();

        return response()->json([
            'unread_count' => $count,
            'notifications' => $notifications,
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $notification->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    /**
     * Mark all of the user's unread notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
