<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\Workgroup;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ShiftController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'workgroup_id' => ['required', 'integer', 'exists:workgroups,id'],
            'position_name' => ['required', 'string', 'max:255'],
            'desk_type' => ['nullable', 'string', 'max:64'],
            'start_date' => ['required', 'date'],
            'start_time' => ['required', 'string', 'regex:/^\d{1,2}:\d{2}(?::\d{2})?$/'],
            'end_date' => ['nullable', 'date'],
            'end_time' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}(?::\d{2})?$/'],
            'regulatory' => ['boolean'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $workgroupId = (int) $request->input('workgroup_id');
        $belongsTo = $user->workgroups()->where('workgroup_id', $workgroupId)->exists();
        if (! $belongsTo) {
            return response()->json(['message' => 'You do not belong to this workgroup.'], 403);
        }

        $start = Carbon::parse($request->input('start_date').' '.$request->input('start_time'), 'America/Chicago')->utc();

        $endDate = $request->input('end_date');
        $endTime = $request->input('end_time');
        if ($endDate && $endTime) {
            $end = Carbon::parse($endDate.' '.$endTime, 'America/Chicago')->utc();
            if ($end->lte($start)) {
                return response()->json(['errors' => ['end_time' => ['End must be after start.']]], 422);
            }
        } else {
            $workgroup = Workgroup::with('allowedStartTimes')->find($workgroupId);
            $startTimeNormalized = Carbon::parse('1970-01-01 '.$request->input('start_time'))->format('H:i');
            $allowed = $workgroup?->allowedStartTimes->first(function ($t) use ($startTimeNormalized) {
                $tStr = $t->start_time instanceof Carbon ? $t->start_time->format('H:i') : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5);

                return $tStr === $startTimeNormalized;
            });
            if (! $allowed) {
                return response()->json(['errors' => ['start_time' => ['Start time must be an allowed start time for this workgroup, or provide end date/time for a non-standard shift.']]], 422);
            }
            $end = $start->copy()->addMinutes((int) $allowed->default_duration_minutes);
        }

        $shift = Shift::create([
            'user_id' => $user->id,
            'workgroup_id' => $workgroupId,
            'position_name' => $request->input('position_name'),
            'desk_type' => $request->input('desk_type'),
            'start_time_utc' => $start,
            'end_time_utc' => $end,
            'regulatory' => (bool) $request->input('regulatory', false),
        ]);

        return response()->json([
            'id' => $shift->id,
            'position_name' => $shift->position_name,
            'start_time_utc' => $shift->start_time_utc->toIso8601String(),
            'end_time_utc' => $shift->end_time_utc->toIso8601String(),
        ], 201);
    }

    /**
     * Update shift. Accepts full edit: start_date, start_time, end_date, end_time, workgroup_id, position_name, desk_type, regulatory.
     */
    public function update(Request $request, Shift $shift): JsonResponse
    {
        if ($shift->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validator = Validator::make($request->all(), [
            'start_date' => ['required', 'date'],
            'start_time' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}(?::\d{2})?$/'],
            'end_date' => ['nullable', 'date'],
            'end_time' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}(?::\d{2})?$/'],
            'workgroup_id' => ['nullable', 'integer', 'exists:workgroups,id'],
            'position_name' => ['nullable', 'string', 'max:255'],
            'desk_type' => ['nullable', 'string', 'max:64'],
            'regulatory' => ['nullable', 'boolean'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();
        $startDate = $request->input('start_date');
        $startTime = $request->input('start_time');
        if ($startTime === null || $startTime === '') {
            $startTime = $shift->start_time_utc->setTimezone('America/Chicago')->format('H:i');
        }
        $newStart = Carbon::parse($startDate.' '.$startTime, 'America/Chicago')->utc();

        $endDate = $request->input('end_date');
        $endTime = $request->input('end_time');
        if ($endDate && $endTime) {
            $newEnd = Carbon::parse($endDate.' '.$endTime, 'America/Chicago')->utc();
            if ($newEnd->lte($newStart)) {
                return response()->json(['errors' => ['end_time' => ['End must be after start.']]], 422);
            }
        } else {
            $durationMinutes = (int) $shift->start_time_utc->diffInMinutes($shift->end_time_utc);
            $newEnd = $newStart->copy()->addMinutes($durationMinutes);
        }

        $workgroupId = $request->has('workgroup_id') ? (int) $request->input('workgroup_id') : $shift->workgroup_id;
        if ($workgroupId !== $shift->workgroup_id && ! $user->workgroups()->where('workgroup_id', $workgroupId)->exists()) {
            return response()->json(['message' => 'You do not belong to this workgroup.'], 403);
        }

        $updates = [
            'start_time_utc' => $newStart,
            'end_time_utc' => $newEnd,
        ];
        if ($request->has('workgroup_id')) {
            $updates['workgroup_id'] = $workgroupId;
        }
        if ($request->has('position_name')) {
            $updates['position_name'] = $request->input('position_name');
        }
        if ($request->has('desk_type')) {
            $updates['desk_type'] = $request->input('desk_type');
        }
        if ($request->has('regulatory')) {
            $updates['regulatory'] = (bool) $request->input('regulatory');
        }

        $shift->update($updates);

        return response()->json([
            'id' => $shift->id,
            'position_name' => $shift->position_name,
            'start_time_utc' => $shift->start_time_utc->toIso8601String(),
            'end_time_utc' => $shift->end_time_utc->toIso8601String(),
        ]);
    }

    public function destroy(Request $request, Shift $shift): JsonResponse
    {
        if ($shift->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $shift->delete();

        return response()->json(['ok' => true]);
    }
}
