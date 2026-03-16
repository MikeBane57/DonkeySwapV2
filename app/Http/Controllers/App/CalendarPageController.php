<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\SwapPost;
use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class CalendarPageController extends Controller
{
    /**
     * Calendar page with initial shifts for the next 14 days (UTC).
     * Frontend can still poll /api/calendar/events for updates.
     */
    public function index(): Response
    {
        $user = request()->user();
        $now = Carbon::now()->utc();
        $end = $now->copy()->addDays(14);

        $shifts = Shift::with('workgroup')
            ->where('user_id', $user->id)
            ->where('start_time_utc', '>=', $now)
            ->where('start_time_utc', '<', $end)
            ->orderBy('start_time_utc')
            ->get();

        $shiftIds = $shifts->pluck('id')->toArray();
        $swapPosts = SwapPost::whereIn('shift_id', $shiftIds)
            ->where('status', 'open')
            ->get()
            ->keyBy('shift_id');

        $events = $shifts->map(fn ($shift) => [
            'id' => 'shift-'.$shift->id,
            'title' => $shift->position_name.($swapPosts->has($shift->id) ? ' [Post]' : ''),
            'start' => $shift->start_time_utc->toIso8601String(),
            'end' => $shift->end_time_utc->toIso8601String(),
            'extendedProps' => [
                'shiftId' => $shift->id,
                'regulatory' => $shift->regulatory,
                'postType' => $swapPosts->get($shift->id)?->type,
                'postId' => $swapPosts->get($shift->id)?->id,
                'cashAmount' => $swapPosts->get($shift->id)?->cash_amount,
                'flightFollowMinutes' => $swapPosts->get($shift->id)?->flight_follow_minutes,
                'workgroup_name' => $shift->workgroup?->name,
            ],
        ]);

        return Inertia::render('app/calendar', [
            'shifts' => $shifts->map(fn ($s) => [
                'id' => $s->id,
                'position_name' => $s->position_name,
                'start_time_utc' => $s->start_time_utc->toIso8601String(),
                'end_time_utc' => $s->end_time_utc->toIso8601String(),
                'workgroup_name' => $s->workgroup?->name,
                'regulatory' => $s->regulatory,
            ]),
            'initialEvents' => $events,
        ]);
    }
}
