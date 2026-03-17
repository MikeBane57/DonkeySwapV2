<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserLfwDateRange;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LfwDateRangeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => ['nullable', 'string', 'max:255'],
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $range = UserLfwDateRange::create([
            'user_id' => $request->user()->id,
            'title' => $request->input('title') ?: 'LFW',
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
        ]);

        return response()->json([
            'id' => $range->id,
            'title' => $range->title,
            'dateFrom' => $range->date_from->format('Y-m-d'),
            'dateTo' => $range->date_to->format('Y-m-d'),
        ], 201);
    }

    public function destroy(Request $request, UserLfwDateRange $userLfwDateRange): JsonResponse
    {
        if ($userLfwDateRange->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $userLfwDateRange->delete();

        return response()->json(['ok' => true]);
    }
}
