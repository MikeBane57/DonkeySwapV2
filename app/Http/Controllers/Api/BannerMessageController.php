<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminBannerMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BannerMessageController extends Controller
{
    /**
     * Mark a banner message as acknowledged by the current user (so it no longer shows on their dashboard).
     */
    public function acknowledge(Request $request, AdminBannerMessage $bannerMessage): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $isRecipient = $bannerMessage->recipients()->where('user_id', $user->id)->exists();
        if (! $isRecipient) {
            return response()->json(['message' => 'You are not a recipient of this message.'], 403);
        }

        $already = $bannerMessage->acknowledgements()->where('user_id', $user->id)->exists();
        if (! $already) {
            $bannerMessage->acknowledgements()->attach($user->id, ['acknowledged_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }
}
