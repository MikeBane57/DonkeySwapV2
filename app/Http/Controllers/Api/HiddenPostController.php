<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SwapPost;
use App\Models\UserHiddenPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HiddenPostController extends Controller
{
    public function hide(Request $request, SwapPost $post): JsonResponse
    {
        $user = $request->user();
        if ($post->user_id === $user->id) {
            return response()->json(['message' => 'You cannot hide your own post.'], 403);
        }
        UserHiddenPost::firstOrCreate([
            'user_id' => $user->id,
            'swap_post_id' => $post->id,
        ]);
        return response()->json(['ok' => true]);
    }

    public function unhideAll(Request $request): JsonResponse
    {
        UserHiddenPost::where('user_id', $request->user()->id)->delete();
        return response()->json(['ok' => true]);
    }
}
