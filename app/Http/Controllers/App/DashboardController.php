<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\AdminBannerMessage;
use App\Models\Shift;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use App\Models\UserTimeOffRange;
use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user = request()->user();
        $now = Carbon::now()->utc();
        $end = $now->copy()->addDays(14);

        // Expire open posts whose shift has ended (so they no longer appear anywhere)
        SwapPost::where('status', 'open')
            ->whereHas('shift', fn ($q) => $q->where('end_time_utc', '<', $now))
            ->update(['status' => 'expired']);

        // Current shift (active now)
        $currentShift = Shift::with('workgroup')
            ->where('user_id', $user->id)
            ->where('start_time_utc', '<=', $now)
            ->where('end_time_utc', '>', $now)
            ->first();

        // Next shift (first upcoming)
        $nextShift = Shift::with('workgroup')
            ->where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->orderBy('start_time_utc')
            ->first();

        // Upcoming shifts (next several)
        $upcomingShifts = Shift::with('workgroup')
            ->where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->orderBy('start_time_utc')
            ->limit(5)
            ->get()
            ->map(fn ($s) => $this->mapShift($s));

        // Active posts: my open postings where shift hasn't started yet (active until shift start)
        $activePosts = SwapPost::with('shift.workgroup')
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->whereHas('shift', fn ($q) => $q->where('start_time_utc', '>', $now))
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($p) use ($now) {
                $start = $p->shift?->start_time_utc;
                $within24h = $start ? $now->copy()->addHours(24)->gte($start) : false;
                return [
                    'id' => $p->id,
                    'type' => $p->type,
                    'cash_amount' => $p->cash_amount,
                    'flight_follow_minutes' => $p->flight_follow_minutes,
                    'flight_follow_at' => $p->flight_follow_at,
                    'notes' => $p->notes,
                    'preferred_start_times' => $p->preferred_start_times,
                    'shift_id' => $p->shift_id,
                    'position_name' => $p->shift?->position_name,
                    'desk_type' => $p->shift?->desk_type,
                    'workgroup_id' => $p->shift?->workgroup_id,
                    'workgroup_name' => $p->shift?->workgroup?->name,
                    'start_time_utc' => $p->shift?->start_time_utc?->toIso8601String(),
                    'end_time_utc' => $p->shift?->end_time_utc?->toIso8601String(),
                    'within_24h' => $within24h,
                ];
            })
            ->values()
            ->all();

        // Action required: pending offers on my posts whose shift hasn't ended (someone responded, waiting for me to accept/reject)
        $offers = SwapOffer::with(['swapPost.shift', 'offeredBy', 'offeredShift'])
            ->where('status', 'pending')
            ->whereHas('swapPost', fn ($q) => $q->where('user_id', $user->id))
            ->whereHas('swapPost', fn ($q) => $q->whereHas('shift', fn ($q2) => $q2->where('end_time_utc', '>=', $now)))
            ->orderBy('created_at', 'desc')
            ->get();

        $offerIdsForShifts = $offers->flatMap(function ($offer) {
            $order = $offer->offered_shift_preference_order;
            if (is_array($order) && count($order) > 0) {
                return $order;
            }
            return $offer->offered_shift_id ? [$offer->offered_shift_id] : [];
        })->unique()->filter()->values()->all();
        $shiftsById = $offerIdsForShifts ? Shift::whereIn('id', $offerIdsForShifts)->get()->keyBy('id') : collect();

        $actionRequired = $offers->map(function ($offer) use ($shiftsById) {
            $offeredShifts = [];
            $order = $offer->offered_shift_preference_order;
            $ids = is_array($order) && count($order) > 0 ? $order : ($offer->offered_shift_id ? [$offer->offered_shift_id] : []);
            foreach ($ids as $sid) {
                $shift = $shiftsById->get($sid);
                if ($shift) {
                    $offeredShifts[] = [
                        'id' => $shift->id,
                        'position_name' => $shift->position_name,
                        'start_time_utc' => $shift->start_time_utc?->toIso8601String(),
                        'end_time_utc' => $shift->end_time_utc?->toIso8601String(),
                    ];
                }
            }
            $firstOffered = $offer->offeredShift;
            $offeredShiftSummary = $firstOffered
                ? $firstOffered->position_name . ' · ' . ($firstOffered->start_time_utc ? $firstOffered->start_time_utc->format('M j, g:i A') : '')
                : null;
            $offerer = $offer->offeredBy;
            $contactMethod = $offerer?->preferred_contact_method ?? 'email';
            $contactLabel = null;
            if ($offerer) {
                if (($contactMethod === 'call' || $contactMethod === 'text') && ! empty(trim((string) $offerer->phone))) {
                    $contactLabel = ucfirst($contactMethod) . ': ' . trim($offerer->phone);
                } else {
                    $contactLabel = 'Email: ' . ($offerer->email ?? '');
                }
            }
            return [
                'id' => $offer->id,
                'swap_post_id' => $offer->swap_post_id,
                'shift_id' => $offer->swapPost?->shift_id,
                'post_type' => $offer->swapPost?->type,
                'position_name' => $offer->swapPost?->shift?->position_name,
                'start_time_utc' => $offer->swapPost?->shift?->start_time_utc?->toIso8601String(),
                'end_time_utc' => $offer->swapPost?->shift?->end_time_utc?->toIso8601String(),
                'offered_by_name' => $offerer?->name,
                'offered_by_contact' => $contactLabel,
                'offered_by_contact_method' => $contactMethod,
                'response_notes' => $offer->response_notes ? trim($offer->response_notes) : null,
                'offered_shift_summary' => $offeredShiftSummary,
                'offered_shifts' => $offeredShifts,
                'cash_amount' => $offer->swapPost?->cash_amount !== null ? (float) $offer->swapPost->cash_amount : null,
            ];
        })->values()->all();

        // Calendar events (next 14 days)
        $shifts = Shift::with('workgroup')
            ->where('user_id', $user->id)
            ->where('start_time_utc', '>=', $now)
            ->where('start_time_utc', '<', $end)
            ->orderBy('start_time_utc')
            ->get();

        $shiftIds = $shifts->pluck('id')->toArray();
        $openPostsByShift = SwapPost::whereIn('shift_id', $shiftIds)
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->get()
            ->groupBy('shift_id');

        $initialEvents = $shifts->map(function ($shift) use ($openPostsByShift) {
            $startDt = $shift->start_time_utc;
            $endDt = $shift->end_time_utc;
            if ($endDt->format('H:i:s') === '00:00:00' && $endDt->toDateString() === $startDt->copy()->addDay()->toDateString()) {
                $endDt = $startDt->copy()->endOfDay();
            }
            return [
            'id' => 'shift-' . $shift->id,
            'title' => $shift->position_name . ($openPostsByShift->has($shift->id) ? ' [Post]' : ''),
            'start' => $startDt->toIso8601String(),
            'end' => $endDt->toIso8601String(),
            'extendedProps' => [
                'shiftId' => $shift->id,
                'position_name' => $shift->position_name,
                'desk_type' => $shift->desk_type,
                'regulatory' => $shift->regulatory,
                'posts' => $openPostsByShift->get($shift->id, collect())->map(fn ($p) => [
                    'id' => $p->id,
                    'type' => $p->type,
                    'cash_amount' => $p->cash_amount ? (float) $p->cash_amount : null,
                    'flight_follow_minutes' => $p->flight_follow_minutes,
                    'flight_follow_at' => $p->flight_follow_at,
                    'notes' => $p->notes,
                    'preferred_start_times' => $p->preferred_start_times,
                ])->values()->all(),
                'workgroup_id' => $shift->workgroup_id,
                'workgroup_name' => $shift->workgroup?->name,
            ],
            ];
        });

        // Current month stats (UTC calendar month)
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd = $now->copy()->endOfMonth();
        $daysInMonth = (int) $monthStart->format('t');
        $shiftsThisMonth = Shift::where('user_id', $user->id)
            ->where('end_time_utc', '>=', $monthStart)
            ->where('start_time_utc', '<=', $monthEnd)
            ->get();
        $uniqueDaysWithShift = collect($shiftsThisMonth->flatMap(function ($s) {
            $start = Carbon::parse($s->start_time_utc);
            $end = Carbon::parse($s->end_time_utc);
            $out = [];
            for ($d = $start->copy()->startOfDay(); $d->lte($end); $d->addDay()) {
                $out[] = $d->format('Y-m-d');
            }
            return $out;
        }))->unique()->count();
        $daysOffThisMonth = $daysInMonth - $uniqueDaysWithShift;
        if ($daysOffThisMonth < 0) {
            $daysOffThisMonth = 0;
        }

        $timeOffRanges = UserTimeOffRange::where('user_id', $user->id)
            ->orderBy('start_date')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title,
                'start_date' => $r->start_date->format('Y-m-d'),
                'end_date' => $r->end_date->format('Y-m-d'),
                'notes' => $r->notes,
            ]);

        $userWorkgroups = $user->workgroups()
            ->selectRaw('workgroups.id as id, workgroups.name as name')
            ->with(['allowedStartTimes', 'deskTypes', 'positionRanges.deskType', 'qualifications'])
            ->orderBy('workgroups.name')
            ->get()
            ->map(function ($wg) {
                $positions = \App\Models\WorkgroupPositionRange::expandRangesToPositions($wg->positionRanges);
                return [
                    'id' => $wg->id,
                    'name' => $wg->name,
                    'allowed_start_times' => $wg->allowedStartTimes
                        ->sortBy(function ($t) {
                            $raw = $t->start_time instanceof \Carbon\Carbon
                                ? $t->start_time->format('H:i')
                                : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5);
                            $parts = explode(':', $raw);
                            return sprintf('%02d:%02d', (int) ($parts[0] ?? 0), (int) ($parts[1] ?? 0));
                        })
                        ->values()
                        ->map(fn ($t) => [
                            'start_time' => $t->start_time instanceof \Carbon\Carbon
                                ? $t->start_time->format('H:i')
                                : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5),
                            'default_duration_minutes' => (int) $t->default_duration_minutes,
                        ])
                        ->values()
                        ->all(),
                    'desk_types' => $wg->deskTypes->map(fn ($d) => ['code' => $d->code, 'label' => $d->label])->values()->all(),
                    'positions' => $positions,
                ];
            });

        $userIsDispatch = $user->workgroupQualifications()->where('code', 'DSP')->exists();

        $defaultWorkgroupId = collect($userWorkgroups)->sortBy(fn ($wg) => strtolower($wg['name']) === 'dispatch' ? 1 : 0)->first()['id'] ?? null;

        // Unacknowledged admin banner messages for this user (show at top of dashboard until acknowledged; respect active range in UTC)
        $bannerMessages = AdminBannerMessage::whereHas('recipients', fn ($q) => $q->where('user_id', $user->id))
            ->whereDoesntHave('acknowledgements', fn ($q) => $q->where('user_id', $user->id))
            ->where(function ($q) use ($now) {
                $q->whereNull('active_at_start')->orWhere('active_at_start', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('active_at_end')->orWhere('active_at_end', '>=', $now);
            })
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'body', 'created_at'])
            ->map(fn ($m) => [
                'id' => $m->id,
                'title' => $m->title,
                'body' => $m->body,
                'created_at' => $m->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return Inertia::render('app/dashboard', [
            'currentShift' => $currentShift ? $this->mapShift($currentShift) : null,
            'nextShift' => $nextShift ? $this->mapShift($nextShift) : null,
            'upcomingShifts' => $upcomingShifts,
            'activePosts' => $activePosts,
            'actionRequired' => $actionRequired,
            'initialEvents' => $initialEvents,
            'monthStats' => [
                'month_label' => $monthStart->format('F Y'),
                'shifts_count' => $shiftsThisMonth->count(),
                'days_off_count' => $daysOffThisMonth,
                'action_required_count' => count($actionRequired),
            ],
            'timeOffRanges' => $timeOffRanges,
            'userWorkgroups' => $userWorkgroups,
            'userIsDispatch' => $userIsDispatch,
            'defaultWorkgroupId' => $defaultWorkgroupId,
            'bannerMessages' => $bannerMessages,
        ]);
    }

    private function mapShift(Shift $s): array
    {
        return [
            'id' => $s->id,
            'position_name' => $s->position_name,
            'desk_type' => $s->desk_type,
            'start_time_utc' => $s->start_time_utc->toIso8601String(),
            'end_time_utc' => $s->end_time_utc->toIso8601String(),
            'workgroup_id' => $s->workgroup_id,
            'workgroup_name' => $s->workgroup?->name,
        ];
    }
}
