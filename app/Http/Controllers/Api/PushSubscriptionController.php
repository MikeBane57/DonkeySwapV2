<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    /**
     * Store or update the current user's push subscription for web push notifications.
     * Body: { endpoint, keys: { p256dh, auth } } (from PushSubscription.toJSON()).
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => ['required', 'string', 'max:500'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
        ]);

        $user = $request->user();
        $endpoint = $request->input('endpoint');
        $keys = $request->input('keys');
        $p256dh = $keys['p256dh'] ?? '';
        $auth = $keys['auth'] ?? '';

        $user->updatePushSubscription($endpoint, $p256dh, $auth, 'aes128gcm');

        return response()->json(['ok' => true]);
    }

    /**
     * Remove the current user's push subscription (e.g. on logout or "disable notifications").
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => ['required', 'string', 'max:500'],
        ]);

        $request->user()->deletePushSubscription($request->input('endpoint'));

        return response()->json(['ok' => true]);
    }
}
