<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserTimeOffRange;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TimeOffRangeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $ranges = UserTimeOffRange::where('user_id', $request->user()->id)
            ->orderBy('start_date')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title,
                'start_date' => $r->start_date->format('Y-m-d'),
                'end_date' => $r->end_date->format('Y-m-d'),
                'notes' => $r->notes,
            ]);

        return response()->json($ranges);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => ['nullable', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $range = UserTimeOffRange::create([
            'user_id' => $request->user()->id,
            'title' => $request->input('title'),
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'notes' => $request->input('notes'),
        ]);

        return response()->json([
            'id' => $range->id,
            'title' => $range->title,
            'start_date' => $range->start_date->format('Y-m-d'),
            'end_date' => $range->end_date->format('Y-m-d'),
            'notes' => $range->notes,
        ], 201);
    }

    public function destroy(Request $request, UserTimeOffRange $userTimeOffRange): JsonResponse
    {
        if ($userTimeOffRange->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $userTimeOffRange->delete();
        return response()->json(['ok' => true]);
    }
}
