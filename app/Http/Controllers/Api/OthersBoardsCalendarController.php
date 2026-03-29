<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LookingForWorkPost;
use App\Models\Shift;
use App\Models\SwapPost;
use App\Models\User;
use App\Models\UserLfwDateRange;
use App\Models\UserTimeOffRange;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OthersBoardsCalendarController extends Controller
{
    private const MAX_OVERLAY_USERS = 25;

    /**
     * Coworkers who share at least one workgroup with the viewer (excluding self).
     *
     * @return array<int, array{id: int, name: string}>
     */
    public function eligibleUsers(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $wgIds = $viewer->workgroups()->pluck('workgroups.id');
        if ($wgIds->isEmpty()) {
            return response()->json([]);
        }

        $users = User::query()
            ->where('id', '!=', $viewer->id)
            ->whereHas('workgroups', fn ($q) => $q->whereIn('workgroups.id', $wgIds))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])
            ->values()
            ->all();

        return response()->json($users);
    }

    /**
     * Shifts, need-off, LFW date ranges, and open LFW posts for selected coworkers (same date range as calendar API).
     *
     * Accepts `user_ids` as a comma-separated string (recommended for GET) or as an array
     * (`user_ids[]=1&user_ids[]=2`). Some stacks do not populate PHP's query array for bracket keys.
     */
    public function overlay(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $validated = $request->validate([
            'start' => ['required', 'date'],
            'end' => ['required', 'date'],
        ]);

        $requestedIds = $this->parseOverlayUserIds($request);

        if ($requestedIds === []) {
            return response()->json(['events' => []]);
        }

        if (count($requestedIds) > self::MAX_OVERLAY_USERS) {
            return response()->json(['message' => 'Too many users selected.'], 422);
        }

        foreach ($requestedIds as $id) {
            if (! User::whereKey($id)->exists()) {
                return response()->json(['message' => 'Invalid user.'], 422);
            }
        }

        $eligibleSet = array_fill_keys($this->eligibleUserIds($viewer), true);
        $viewerId = (int) $viewer->id;
        foreach ($requestedIds as $id) {
            if ($id === $viewerId || ! isset($eligibleSet[$id])) {
                return response()->json([
                    'message' => 'One or more selected users cannot be shown on this board.',
                ], 422);
            }
        }

        $startDt = Carbon::parse($validated['start'])->startOfDay();
        $endDt = Carbon::parse($validated['end'])->endOfDay();

        $users = User::whereIn('id', $requestedIds)->get()->keyBy('id');

        $events = [];
        foreach ($requestedIds as $userId) {
            $name = $users->get($userId)?->name ?? 'User #'.$userId;

            $shifts = Shift::with('workgroup')
                ->where('user_id', $userId)
                ->where('end_time_utc', '>=', $startDt)
                ->where('start_time_utc', '<=', $endDt)
                ->orderBy('start_time_utc')
                ->get();

            $shiftIds = $shifts->pluck('id')->toArray();
            $swapPostsByShift = $shiftIds === []
                ? collect()
                : SwapPost::whereIn('shift_id', $shiftIds)
                    ->where('user_id', $userId)
                    ->where('status', 'open')
                    ->get()
                    ->groupBy('shift_id');

            foreach ($shifts as $shift) {
                $shiftStart = $shift->start_time_utc;
                $shiftEnd = $shift->end_time_utc;
                if ($shiftEnd->format('H:i:s') === '00:00:00' && $shiftEnd->toDateString() === $shiftStart->copy()->addDay()->toDateString()) {
                    $shiftEnd = $shiftStart->copy()->endOfDay();
                }
                $posts = $swapPostsByShift->get($shift->id, collect())->map(fn ($p) => [
                    'id' => $p->id,
                    'type' => $p->type,
                    'cash_amount' => $p->cash_amount ? (float) $p->cash_amount : null,
                    'flight_follow_minutes' => $p->flight_follow_minutes,
                    'flight_follow_at' => $p->flight_follow_at,
                    'notes' => $p->notes,
                    'preferred_start_times' => $p->preferred_start_times,
                    'preferred_desk_type' => $p->preferred_desk_type,
                    'payback_date_ranges' => $p->payback_date_ranges,
                    'allow_counter_offers' => (bool) $p->allow_counter_offers,
                ])->values()->all();
                $hasPost = count($posts) > 0;
                $events[] = [
                    'id' => 'overlay-shift-'.$userId.'-'.$shift->id,
                    'title' => $shift->position_name.($hasPost ? ' [Post]' : ''),
                    'start' => $shiftStart->toIso8601String(),
                    'end' => $shiftEnd->toIso8601String(),
                    'allDay' => false,
                    'extendedProps' => [
                        'overlayUserId' => $userId,
                        'overlayUserName' => $name,
                        'isOverlayOther' => true,
                        'shiftId' => $shift->id,
                        'position_name' => $shift->position_name,
                        'desk_type' => $shift->desk_type,
                        'regulatory' => $shift->regulatory,
                        'is_training' => (bool) $shift->is_training,
                        'posts' => $posts,
                        'workgroup_id' => $shift->workgroup_id,
                        'workgroup_name' => $shift->workgroup?->name,
                    ],
                ];
            }

            $ranges = UserTimeOffRange::where('user_id', $userId)
                ->where('start_date', '<=', $endDt->toDateString())
                ->where('end_date', '>=', $startDt->toDateString())
                ->orderBy('start_date')
                ->get();

            foreach ($ranges as $r) {
                $title = $r->title ? trim((string) $r->title) : '';
                if ($title === '') {
                    $title = $r->notes ? trim((string) $r->notes) : 'Need off';
                }
                $endExclusive = $r->end_date->copy()->addDay();
                $events[] = [
                    'id' => 'overlay-timeoff-'.$userId.'-'.$r->id,
                    'title' => $title,
                    'start' => $r->start_date->format('Y-m-d'),
                    'end' => $endExclusive->format('Y-m-d'),
                    'allDay' => true,
                    'extendedProps' => [
                        'overlayUserId' => $userId,
                        'overlayUserName' => $name,
                        'isOverlayOther' => true,
                        'isOverlayTimeOff' => true,
                    ],
                ];
            }

            $lfwRanges = UserLfwDateRange::where('user_id', $userId)
                ->where('date_from', '<=', $endDt->toDateString())
                ->where('date_to', '>=', $startDt->toDateString())
                ->orderBy('date_from')
                ->get();

            foreach ($lfwRanges as $lr) {
                $lfwTitle = $lr->title ? trim((string) $lr->title) : '';
                if ($lfwTitle === '') {
                    $lfwTitle = 'Looking for work';
                }
                $lfwEndExclusive = $lr->date_to->copy()->addDay();
                $events[] = [
                    'id' => 'overlay-lfw-'.$userId.'-'.$lr->id,
                    'title' => $lfwTitle,
                    'start' => $lr->date_from->format('Y-m-d'),
                    'end' => $lfwEndExclusive->format('Y-m-d'),
                    'allDay' => true,
                    'extendedProps' => [
                        'overlayUserId' => $userId,
                        'overlayUserName' => $name,
                        'isOverlayOther' => true,
                        'isOverlayLfw' => true,
                    ],
                ];
            }

            $lfwPosts = LookingForWorkPost::query()
                ->where('user_id', $userId)
                ->where('status', 'open')
                ->where('seeking_date', '>=', $startDt->toDateString())
                ->where('seeking_date', '<=', $endDt->toDateString())
                ->orderBy('seeking_date')
                ->get();

            foreach ($lfwPosts as $lp) {
                $pDate = $lp->seeking_date->format('Y-m-d');
                $pEndEx = $lp->seeking_date->copy()->addDay();
                $cash = (float) $lp->seeking_cash;
                $cashLabel = $cash > 0
                    ? '$'.(floor($cash) === $cash ? (string) (int) $cash : number_format($cash, 2))
                    : null;
                $titleParts = ['LFW post'];
                if ($cashLabel !== null) {
                    $titleParts[] = $cashLabel;
                }
                if ($lp->seeking_obo) {
                    $titleParts[] = 'OBO';
                }
                $events[] = [
                    'id' => 'overlay-lfw-post-'.$userId.'-'.$lp->id,
                    'title' => implode(' · ', $titleParts),
                    'start' => $pDate,
                    'end' => $pEndEx->format('Y-m-d'),
                    'allDay' => true,
                    'extendedProps' => [
                        'overlayUserId' => $userId,
                        'overlayUserName' => $name,
                        'isOverlayOther' => true,
                        'isOverlayLfwPost' => true,
                    ],
                ];
            }
        }

        return response()->json(['events' => $events]);
    }

    /**
     * @return list<int>
     */
    private function eligibleUserIds(User $viewer): array
    {
        $wgIds = $viewer->workgroups()->pluck('workgroups.id');
        if ($wgIds->isEmpty()) {
            return [];
        }

        return User::query()
            ->where('id', '!=', $viewer->id)
            ->whereHas('workgroups', fn ($q) => $q->whereIn('workgroups.id', $wgIds))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    private function parseOverlayUserIds(Request $request): array
    {
        $raw = $request->query('user_ids', $request->input('user_ids'));

        if ($raw === null || $raw === '' || $raw === []) {
            return [];
        }

        if (is_string($raw)) {
            return collect(explode(',', $raw))
                ->map(fn ($s) => (int) trim((string) $s))
                ->filter(fn (int $id) => $id > 0)
                ->unique()
                ->values()
                ->all();
        }

        if (is_array($raw)) {
            return collect($raw)
                ->map(fn ($v) => (int) $v)
                ->filter(fn (int $id) => $id > 0)
                ->unique()
                ->values()
                ->all();
        }

        return [];
    }
}
