<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\LookingForWorkPost;
use App\Models\Shift;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    /**
     * Return calendar events (shifts + swap posts) for the authenticated user and date range.
     * Events are in UTC; frontend converts to Central (and optional Zulu) per user preference.
     * Shifts the user would receive from a pending offer (they responded to someone else's post)
     * are included as tentative events with pending_incoming so they appear on the calendar
     * but are not committed to the user's schedule.
     */
    public function events(Request $request): JsonResponse
    {
        $user = $request->user();
        $start = $request->input('start', now()->startOfMonth()->toIso8601String());
        $end = $request->input('end', now()->endOfMonth()->toIso8601String());

        $startDt = Carbon::parse($start)->startOfDay();
        $endDt = Carbon::parse($end)->endOfDay();

        $shifts = Shift::with('workgroup')
            ->where('user_id', $user->id)
            ->where('end_time_utc', '>=', $startDt)
            ->where('start_time_utc', '<=', $endDt)
            ->get();

        $shiftIds = $shifts->pluck('id')->toArray();
        $swapPostsByShift = SwapPost::whereIn('shift_id', $shiftIds)
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->get()
            ->groupBy('shift_id');

        // Shifts where the poster has a pending offer to respond to (action required).
        $actionRequiredByShiftId = SwapOffer::where('status', 'pending')
            ->whereHas('swapPost', fn ($q) => $q->where('user_id', $user->id))
            ->with('swapPost')
            ->get()
            ->groupBy(fn ($o) => $o->swapPost?->shift_id)
            ->filter(fn ($_, $shiftId) => $shiftId !== null && $shiftId !== '')
            ->map(fn ($offers) => $offers->first()->id)
            ->all();

        // Shifts that are "new" (user received via accepted offer) until they dismiss the notification.
        $newShiftNotificationByShiftId = AppNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->where('type', 'swap_accepted')
            ->get()
            ->filter(fn (AppNotification $n) => ! empty($n->data['shift_id'] ?? null))
            ->keyBy(fn (AppNotification $n) => $n->data['shift_id']);

        $events = [];
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
            $actionRequiredOfferId = $actionRequiredByShiftId[$shift->id] ?? null;
            $newShiftNotification = $newShiftNotificationByShiftId->get($shift->id);
            $events[] = [
                'id' => 'shift-'.$shift->id,
                'title' => $shift->position_name.($hasPost ? ' [Post]' : ''),
                'start' => $shiftStart->toIso8601String(),
                'end' => $shiftEnd->toIso8601String(),
                'extendedProps' => [
                    'shiftId' => $shift->id,
                    'position_name' => $shift->position_name,
                    'desk_type' => $shift->desk_type,
                    'regulatory' => $shift->regulatory,
                    'posts' => $posts,
                    'workgroup_id' => $shift->workgroup_id,
                    'workgroup_name' => $shift->workgroup?->name,
                    'action_required' => $actionRequiredOfferId !== null,
                    'action_required_offer_id' => $actionRequiredOfferId,
                    'is_new_shift' => $newShiftNotification !== null,
                    'new_shift_notification_id' => $newShiftNotification?->id,
                ],
            ];
        }

        // Shifts the user would receive if their pending offer is accepted (they responded to someone else's post).
        $pendingIncomingShiftIds = SwapOffer::where('offered_by_user_id', $user->id)
            ->where('status', 'pending')
            ->with('swapPost')
            ->get()
            ->map(fn ($offer) => $offer->swapPost?->shift_id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (count($pendingIncomingShiftIds) > 0) {
            $pendingShifts = Shift::with('workgroup')
                ->whereIn('id', $pendingIncomingShiftIds)
                ->where('end_time_utc', '>=', $startDt)
                ->where('start_time_utc', '<=', $endDt)
                ->get();

            foreach ($pendingShifts as $shift) {
                $shiftStart = $shift->start_time_utc;
                $shiftEnd = $shift->end_time_utc;
                if ($shiftEnd->format('H:i:s') === '00:00:00' && $shiftEnd->toDateString() === $shiftStart->copy()->addDay()->toDateString()) {
                    $shiftEnd = $shiftStart->copy()->endOfDay();
                }
                $events[] = [
                    'id' => 'pending-incoming-'.$shift->id,
                    'title' => $shift->position_name.' (pending)',
                    'start' => $shiftStart->toIso8601String(),
                    'end' => $shiftEnd->toIso8601String(),
                    'extendedProps' => [
                        'shiftId' => $shift->id,
                        'position_name' => $shift->position_name,
                        'desk_type' => $shift->desk_type,
                        'regulatory' => $shift->regulatory,
                        'posts' => [],
                        'workgroup_id' => $shift->workgroup_id,
                        'workgroup_name' => $shift->workgroup?->name,
                        'pending_incoming' => true,
                    ],
                ];
            }
        }

        $lfwPosts = LookingForWorkPost::query()
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->where('seeking_date', '>=', $startDt->toDateString())
            ->where('seeking_date', '<=', $endDt->toDateString())
            ->orderBy('seeking_date')
            ->get();

        foreach ($lfwPosts as $post) {
            $dateStr = $post->seeking_date->format('Y-m-d');
            $endExclusive = $post->seeking_date->copy()->addDay();
            $cash = (float) $post->seeking_cash;
            $cashLabel = $cash > 0
                ? '$'.(floor($cash) === $cash ? (string) (int) $cash : number_format($cash, 2))
                : null;
            $titleParts = ['LFW'];
            if ($cashLabel !== null) {
                $titleParts[] = $cashLabel;
            }
            if ($post->seeking_obo) {
                $titleParts[] = 'OBO';
            }
            if (count($titleParts) === 1) {
                $titleParts[] = 'post';
            }
            $events[] = [
                'id' => 'lfw-post-'.$post->id,
                'title' => implode(' · ', $titleParts),
                'start' => $dateStr,
                'end' => $endExclusive->format('Y-m-d'),
                'allDay' => true,
                'backgroundColor' => 'rgba(245, 158, 11, 0.38)',
                'extendedProps' => [
                    'isLfwPost' => true,
                    'lfw_post_id' => $post->id,
                    'seeking_cash' => $cash,
                    'seeking_obo' => (bool) $post->seeking_obo,
                    'notes' => $post->notes,
                ],
            ];
        }

        return response()->json($events);
    }
}
