<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use App\Models\UserHiddenPost;
use App\Models\UserPreference;
use App\Models\UserTimeOffRange;
use App\Models\Workgroup;
use App\Services\PostEligibilityService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AvailableController extends Controller
{
    public function __construct(
        protected PostEligibilityService $eligibility
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $now = Carbon::now()->utc();

        $query = SwapPost::with(['shift.workgroup', 'user:id,name'])
            ->where('status', 'open')
            ->where('user_id', '!=', $user->id)
            ->whereHas('shift', fn ($q) => $q->where('start_time_utc', '>', $now));

        $hiddenPostIds = UserHiddenPost::where('user_id', $user->id)->pluck('swap_post_id')->all();
        if ($hiddenPostIds !== []) {
            $query->whereNotIn('id', $hiddenPostIds);
        }

        if ($request->filled('workgroup_id')) {
            $query->whereHas('shift', fn ($q) => $q->where('workgroup_id', (int) $request->input('workgroup_id')));
        }
        if ($request->filled('date_from')) {
            $from = Carbon::parse($request->input('date_from'))->startOfDay()->utc();
            $query->whereHas('shift', fn ($q) => $q->where('start_time_utc', '>=', $from));
        }
        if ($request->filled('date_to')) {
            $to = Carbon::parse($request->input('date_to'))->endOfDay()->utc();
            $query->whereHas('shift', fn ($q) => $q->where('start_time_utc', '<=', $to));
        }
        $typeFilter = $request->filled('type') && in_array($request->input('type'), ['trade', 'cash', 'flight_follow', 'time_trade', 'trade_cash'], true)
            ? $request->input('type')
            : null;
        if ($request->filled('desk_type')) {
            $query->whereHas('shift', fn ($q) => $q->where('desk_type', $request->input('desk_type')));
        }
        if ($request->filled('desk_search') && trim($request->input('desk_search')) !== '') {
            $search = '%'.trim($request->input('desk_search')).'%';
            $query->whereHas('shift', fn ($q) => $q->where('position_name', 'like', $search));
        }
        if ($request->filled('min_cash') && is_numeric($request->input('min_cash'))) {
            $minCash = (float) $request->input('min_cash');
            $query->where(function ($q) use ($minCash) {
                $q->where('type', '!=', 'cash')
                    ->orWhere(function ($q2) use ($minCash) {
                        $q2->where('type', 'cash')->where('cash_amount', '>=', $minCash);
                    });
            });
        }

        $posts = $query->orderByRaw('(select start_time_utc from shifts where shifts.id = swap_posts.shift_id)')
            ->get();

        // Increment view_count for each post (admin post manager stats)
        $postIds = $posts->pluck('id')->filter()->values()->all();
        if ($postIds !== []) {
            SwapPost::whereIn('id', $postIds)->increment('view_count');
        }

        // Current user's pending offers on these posts (for "you responded" highlight and edit/cancel)
        $myOffersByPostId = SwapOffer::whereIn('swap_post_id', $posts->pluck('id'))
            ->where('offered_by_user_id', $user->id)
            ->where('status', 'pending')
            ->get()
            ->keyBy('swap_post_id');

        // Pending offer count per post (so others can see "has offer(s)" on the card)
        $pendingOfferCountByPostId = SwapOffer::whereIn('swap_post_id', $posts->pluck('id'))
            ->where('status', 'pending')
            ->selectRaw('swap_post_id, count(*) as c')
            ->groupBy('swap_post_id')
            ->pluck('c', 'swap_post_id')
            ->all();

        $timeOffRanges = UserTimeOffRange::where('user_id', $user->id)
            ->orderBy('start_date')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title ?? $r->notes ?? 'Time off',
                'start_date' => $r->start_date->format('Y-m-d'),
                'end_date' => $r->end_date->format('Y-m-d'),
            ])
            ->values()
            ->all();

        $hideDuringTimeOff = $request->boolean('hide_during_time_off');

        // Start times of the user's upcoming shifts: hide trade posts where the shift we'd receive has the same start (can't trade into double-book). Desk trades (e.g. 6am for 7am same day) are allowed.
        $userShiftStartTimes = Shift::where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->pluck('start_time_utc')
            ->map(fn ($t) => $t->toIso8601String())
            ->values()
            ->all();

        // Dates (Y-m-d) when the user has an upcoming shift: for time_trade, only show posts on days the user has a shift (they must offer a shift on the same date).
        $userShiftsUpcoming = Shift::where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->get();
        $userShiftDates = $userShiftsUpcoming->map(fn (Shift $s) => $s->start_time_utc->format('Y-m-d'))
            ->unique()
            ->values()
            ->all();
        $userShiftCountByDate = $userShiftsUpcoming->groupBy(fn (Shift $s) => $s->start_time_utc->format('Y-m-d'))
            ->map(fn ($dayShifts) => $dayShifts->count())
            ->all();

        $preference = UserPreference::where('user_id', $user->id)->first();
        $hidePostsThatWouldBeDouble = (bool) ($preference->hide_posts_that_would_be_double ?? false);
        $desiredDeskTypes = $preference->desired_desk_types ?? [];
        if (! is_array($desiredDeskTypes)) {
            $desiredDeskTypes = [];
        }

        $preferredOnly = $request->has('preferred_only') ? $request->boolean('preferred_only') : true;
        $showOnlyEligible = $request->has('eligible_only') ? $request->boolean('eligible_only') : true;

        $byShift = [];
        foreach ($posts as $post) {
            $shift = $post->shift;
            if (! $shift) {
                continue;
            }

            if (! $this->eligibility->userCanWorkShift($user, $shift)) {
                continue;
            }

            $deskType = $shift->desk_type;
            if ($preferredOnly && count($desiredDeskTypes) > 0) {
                if ($deskType === null || $deskType === '' || ! in_array($deskType, $desiredDeskTypes, true)) {
                    continue;
                }
            }

            if ($hideDuringTimeOff && count($timeOffRanges) > 0) {
                $shiftDate = $shift->start_time_utc->format('Y-m-d');
                $inTimeOff = false;
                foreach ($timeOffRanges as $range) {
                    if ($shiftDate >= $range['start_date'] && $shiftDate <= $range['end_date']) {
                        $inTimeOff = true;
                        break;
                    }
                }
                if ($inTimeOff) {
                    continue;
                }
            }

            // Trade only: hide if the shift we would receive has the exact same start time as one of our shifts (can't trade into double-book). Different start times (e.g. 6am for 7am desk trade) are allowed.
            if ($post->type === 'trade' && in_array($shift->start_time_utc->toIso8601String(), $userShiftStartTimes, true)) {
                continue;
            }

            $shiftDate = $shift->start_time_utc->format('Y-m-d');
            $userShiftCountOnDate = (int) ($userShiftCountByDate[$shiftDate] ?? 0);
            $wouldBeDouble = false;
            if ($post->type === 'cash') {
                $wouldBeDouble = $userShiftCountOnDate >= 1;
            } elseif ($post->type === 'trade' || $post->type === 'time_trade') {
                $wouldBeDouble = $userShiftCountOnDate >= 2;
            }
            if ($hidePostsThatWouldBeDouble && $wouldBeDouble) {
                continue;
            }

            $eligible = null;
            $ineligibleReason = null;
            $ineligibleReasonDetail = null;

            if ($post->type === 'cash') {
                $result = $this->eligibility->canTakeGiveaway($user, $post);
                $eligible = $result['eligible'];
                $ineligibleReason = $result['reason'] ?? null;
                $ineligibleReasonDetail = $result['reason_detail'] ?? null;
            } elseif ($post->type === 'flight_follow') {
                $result = $this->eligibility->canTakeFlightFollow($user, $post);
                $eligible = $result['eligible'];
                $ineligibleReason = $result['reason'] ?? null;
                $ineligibleReasonDetail = $result['reason_detail'] ?? null;
            } elseif ($post->type === 'time_trade') {
                $postShiftDate = $shift->start_time_utc->format('Y-m-d');
                $hasShiftOnDay = in_array($postShiftDate, $userShiftDates, true);
                $eligible = $hasShiftOnDay;
                if (! $hasShiftOnDay) {
                    $ineligibleReason = 'No shift on this day';
                    $ineligibleReasonDetail = 'Time trades require you to offer a shift on the same date. You have no shift on this day.';
                }
            }

            $shiftId = $shift->id;
            if (! isset($byShift[$shiftId])) {
                $byShift[$shiftId] = [
                    'shift' => [
                        'id' => $shift->id,
                        'position_name' => $shift->position_name,
                        'desk_type' => $shift->desk_type,
                        'start_time_utc' => $shift->start_time_utc?->toIso8601String(),
                        'end_time_utc' => $shift->end_time_utc?->toIso8601String(),
                        'workgroup_id' => $shift->workgroup_id,
                        'workgroup_name' => $shift->workgroup?->name,
                    ],
                    'poster_name' => $post->user?->name,
                    'posts' => [],
                ];
            }

            if ($showOnlyEligible && $eligible === false) {
                continue;
            }

            $myOffer = $myOffersByPostId->get($post->id);
            $pendingOfferCount = (int) ($pendingOfferCountByPostId[$post->id] ?? 0);
            $byShift[$shiftId]['posts'][] = [
                'id' => $post->id,
                'type' => $post->type,
                'cash_amount' => $post->cash_amount ? (float) $post->cash_amount : null,
                'flight_follow_minutes' => $post->flight_follow_minutes,
                'flight_follow_at' => $post->flight_follow_at,
                'notes' => $post->notes,
                'preferred_start_times' => $post->preferred_start_times,
                'preferred_desk_type' => $post->preferred_desk_type,
                'payback_date_ranges' => $post->payback_date_ranges,
                'allow_counter_offers' => (bool) $post->allow_counter_offers,
                'eligible' => $eligible,
                'ineligible_reason' => $ineligibleReason,
                'ineligible_reason_detail' => $ineligibleReasonDetail ?? null,
                'would_be_double' => $wouldBeDouble,
                'pending_offer_count' => $pendingOfferCount,
                'my_offer' => $myOffer ? [
                    'id' => $myOffer->id,
                    'offered_shift_id' => $myOffer->offered_shift_id,
                    'offered_shift_preference_order' => $myOffer->offered_shift_preference_order,
                    'response_notes' => $myOffer->response_notes ? trim($myOffer->response_notes) : null,
                ] : null,
            ];
        }

        $items = [];
        foreach ($byShift as $data) {
            $postsForShift = $data['posts'];
            if ($typeFilter !== null) {
                $postTypes = array_column($postsForShift, 'type');
                $typeMatch = $typeFilter === 'trade_cash'
                    ? (in_array('trade', $postTypes, true) || in_array('cash', $postTypes, true))
                    : in_array($typeFilter, $postTypes, true);
                if (! $typeMatch) {
                    continue;
                }
            }
            if ($showOnlyEligible) {
                $hasEligible = false;
                foreach ($postsForShift as $p) {
                    if ($p['eligible'] !== false) {
                        $hasEligible = true;
                        break;
                    }
                }
                if (! $hasEligible) {
                    continue;
                }
            }
            $items[] = [
                'shift' => $data['shift'],
                'poster_name' => $data['poster_name'],
                'posts' => $postsForShift,
            ];
        }

        usort($items, fn ($a, $b) => strcmp($a['shift']['start_time_utc'] ?? '', $b['shift']['start_time_utc'] ?? ''));

        $userWorkgroupIds = $user->workgroups()->pluck('workgroups.id')->all();
        $workgroupsWithDeskTypes = $userWorkgroupIds === []
            ? collect()
            : Workgroup::with('deskTypes')->whereIn('id', $userWorkgroupIds)->orderBy('name')->get();
        $workgroups = $workgroupsWithDeskTypes->map(fn ($wg) => [
            'id' => $wg->id,
            'name' => $wg->name,
            'desk_types' => $wg->deskTypes->map(fn ($d) => ['code' => $d->code, 'label' => $d->label])->values()->all(),
        ])->values()->all();

        $deskTypesByWorkgroup = $workgroupsWithDeskTypes->keyBy('id')
            ->map(fn ($wg) => $wg->deskTypes->pluck('code')->values()->all())
            ->all();

        $deskTypeLabelsByCode = [];
        foreach ($workgroupsWithDeskTypes as $wg) {
            foreach ($wg->deskTypes as $d) {
                if (! isset($deskTypeLabelsByCode[$d->code])) {
                    $deskTypeLabelsByCode[$d->code] = $d->label;
                }
            }
        }
        $allDeskTypeCodes = array_keys($deskTypeLabelsByCode);
        $deskTypeOptions = array_values(array_map(fn ($code) => [
            'value' => $code,
            'label' => $deskTypeLabelsByCode[$code] ?? $code,
        ], $allDeskTypeCodes));

        $myShifts = Shift::where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->with('workgroup:id,name')
            ->orderBy('start_time_utc')
            ->limit(100)
            ->get()
            ->map(fn (Shift $s) => [
                'id' => $s->id,
                'position_name' => $s->position_name,
                'desk_type' => $s->desk_type,
                'start_time_utc' => $s->start_time_utc->toIso8601String(),
                'end_time_utc' => $s->end_time_utc->toIso8601String(),
                'workgroup_name' => $s->workgroup?->name,
            ])
            ->values()
            ->all();

        $hiddenPostsCount = UserHiddenPost::where('user_id', $user->id)->count();

        return Inertia::render('app/available', [
            'posts' => $items,
            'workgroups' => $workgroups,
            'deskTypeOptions' => $deskTypeOptions,
            'deskTypesByWorkgroup' => $deskTypesByWorkgroup,
            'myShifts' => $myShifts,
            'timeOffRanges' => $timeOffRanges,
            'hidden_posts_count' => $hiddenPostsCount,
            'hide_posts_that_would_be_double' => $hidePostsThatWouldBeDouble,
            'filters' => array_merge($request->only([
                'workgroup_id', 'date_from', 'date_to', 'type',
                'desk_type', 'desk_search', 'min_cash',
            ]), [
                'preferred_only' => $preferredOnly,
                'eligible_only' => $request->has('eligible_only') ? $request->boolean('eligible_only') : true,
                'hide_during_time_off' => $hideDuringTimeOff,
            ]),
        ]);
    }

    /**
     * Return counts of eligible posts for the current user on a given date, by type.
     * Used by the dashboard day popup to show "View posts for" buttons with counts.
     */
    public function eligibleCounts(Request $request): JsonResponse
    {
        $request->validate(['date' => ['required', 'date']]);
        $user = $request->user();
        $now = Carbon::now()->utc();
        $date = Carbon::parse($request->input('date'))->startOfDay()->utc();
        $dateEnd = $date->copy()->endOfDay();

        $posts = SwapPost::with(['shift.workgroup'])
            ->where('status', 'open')
            ->where('user_id', '!=', $user->id)
            ->whereHas('shift', fn ($q) => $q->where('start_time_utc', '>', $now)->where('start_time_utc', '>=', $date)->where('start_time_utc', '<=', $dateEnd))
            ->get();

        $timeOffRanges = UserTimeOffRange::where('user_id', $user->id)
            ->orderBy('start_date')
            ->get()
            ->map(fn ($r) => ['start_date' => $r->start_date->format('Y-m-d'), 'end_date' => $r->end_date->format('Y-m-d')])
            ->values()
            ->all();
        $userShiftStartTimes = Shift::where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->pluck('start_time_utc')
            ->map(fn ($t) => $t->toIso8601String())
            ->values()
            ->all();
        $userShiftDates = Shift::where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->get()
            ->map(fn (Shift $s) => $s->start_time_utc->format('Y-m-d'))
            ->unique()
            ->values()
            ->all();
        $preference = UserPreference::where('user_id', $user->id)->first();
        $desiredDeskTypes = $preference->desired_desk_types ?? [];
        if (! is_array($desiredDeskTypes)) {
            $desiredDeskTypes = [];
        }

        $counts = ['flight_follow' => 0, 'time_trade' => 0, 'trade' => 0, 'cash' => 0];
        foreach ($posts as $post) {
            $shift = $post->shift;
            if (! $shift) {
                continue;
            }
            if (! $this->eligibility->userCanWorkShift($user, $shift)) {
                continue;
            }
            $deskType = $shift->desk_type;
            if (count($desiredDeskTypes) > 0 && ($deskType === null || $deskType === '' || ! in_array($deskType, $desiredDeskTypes, true))) {
                continue;
            }
            $shiftDate = $shift->start_time_utc->format('Y-m-d');
            if (count($timeOffRanges) > 0) {
                $inTimeOff = false;
                foreach ($timeOffRanges as $range) {
                    if ($shiftDate >= $range['start_date'] && $shiftDate <= $range['end_date']) {
                        $inTimeOff = true;
                        break;
                    }
                }
                if ($inTimeOff) {
                    continue;
                }
            }
            if ($post->type === 'trade' && in_array($shift->start_time_utc->toIso8601String(), $userShiftStartTimes, true)) {
                continue;
            }

            $eligible = true;
            if ($post->type === 'cash') {
                $result = $this->eligibility->canTakeGiveaway($user, $post);
                $eligible = $result['eligible'];
            } elseif ($post->type === 'flight_follow') {
                $result = $this->eligibility->canTakeFlightFollow($user, $post);
                $eligible = $result['eligible'];
            } elseif ($post->type === 'time_trade') {
                $eligible = in_array($shiftDate, $userShiftDates, true);
            }

            if (! $eligible) {
                continue;
            }

            if ($post->type === 'flight_follow') {
                $counts['flight_follow']++;
            } elseif ($post->type === 'time_trade') {
                $counts['time_trade']++;
            } elseif ($post->type === 'trade') {
                $counts['trade']++;
            } elseif ($post->type === 'cash') {
                $counts['cash']++;
            }
        }

        return response()->json($counts);
    }

    /**
     * Return dates in range that have at least one eligible giveaway (cash) and/or flight follow (FF) for the current user.
     * Used by the dashboard calendar to show indicators on day cells.
     */
    public function datesWithEligibleGiveaway(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'timezone' => ['nullable', 'string', 'timezone'],
        ]);
        $user = $request->user();
        $now = Carbon::now()->utc();
        $tz = $request->filled('timezone') ? $request->input('timezone') : 'UTC';
        $from = Carbon::parse($request->input('date_from'), $tz)->startOfDay()->utc();
        $to = Carbon::parse($request->input('date_to'), $tz)->endOfDay()->utc();

        $timeOffRanges = UserTimeOffRange::where('user_id', $user->id)
            ->orderBy('start_date')
            ->get()
            ->map(fn ($r) => ['start_date' => $r->start_date->format('Y-m-d'), 'end_date' => $r->end_date->format('Y-m-d')])
            ->values()
            ->all();
        $preference = UserPreference::where('user_id', $user->id)->first();
        $desiredDeskTypes = $preference->desired_desk_types ?? [];
        if (! is_array($desiredDeskTypes)) {
            $desiredDeskTypes = [];
        }

        $datesGiveaway = [];
        $postsCash = SwapPost::with(['shift.workgroup'])
            ->where('status', 'open')
            ->where('type', 'cash')
            ->where('user_id', '!=', $user->id)
            ->whereHas('shift', fn ($q) => $q->where('start_time_utc', '>', $now)->where('start_time_utc', '>=', $from)->where('start_time_utc', '<=', $to))
            ->get();
        foreach ($postsCash as $post) {
            $shift = $post->shift;
            if (! $shift) {
                continue;
            }
            if (! $this->eligibility->userCanWorkShift($user, $shift)) {
                continue;
            }
            $deskType = $shift->desk_type;
            if (count($desiredDeskTypes) > 0 && ($deskType === null || $deskType === '' || ! in_array($deskType, $desiredDeskTypes, true))) {
                continue;
            }
            $shiftDateLocal = $shift->start_time_utc->copy()->setTimezone($tz)->format('Y-m-d');
            if (count($timeOffRanges) > 0) {
                $inTimeOff = false;
                foreach ($timeOffRanges as $range) {
                    if ($shiftDateLocal >= $range['start_date'] && $shiftDateLocal <= $range['end_date']) {
                        $inTimeOff = true;
                        break;
                    }
                }
                if ($inTimeOff) {
                    continue;
                }
            }
            $result = $this->eligibility->canTakeGiveaway($user, $post);
            if (! $result['eligible']) {
                continue;
            }
            $datesGiveaway[$shiftDateLocal] = true;
        }

        $datesFf = [];
        $postsFf = SwapPost::with(['shift.workgroup'])
            ->where('status', 'open')
            ->where('type', 'flight_follow')
            ->where('user_id', '!=', $user->id)
            ->whereHas('shift', fn ($q) => $q->where('start_time_utc', '>', $now)->where('start_time_utc', '>=', $from)->where('start_time_utc', '<=', $to))
            ->get();
        foreach ($postsFf as $post) {
            $shift = $post->shift;
            if (! $shift) {
                continue;
            }
            if (! $this->eligibility->userCanWorkShift($user, $shift)) {
                continue;
            }
            $deskType = $shift->desk_type;
            if (count($desiredDeskTypes) > 0 && ($deskType === null || $deskType === '' || ! in_array($deskType, $desiredDeskTypes, true))) {
                continue;
            }
            $shiftDateLocal = $shift->start_time_utc->copy()->setTimezone($tz)->format('Y-m-d');
            if (count($timeOffRanges) > 0) {
                $inTimeOff = false;
                foreach ($timeOffRanges as $range) {
                    if ($shiftDateLocal >= $range['start_date'] && $shiftDateLocal <= $range['end_date']) {
                        $inTimeOff = true;
                        break;
                    }
                }
                if ($inTimeOff) {
                    continue;
                }
            }
            $result = $this->eligibility->canTakeFlightFollow($user, $post);
            if (! $result['eligible']) {
                continue;
            }
            $datesFf[$shiftDateLocal] = true;
        }

        return response()->json([
            'dates' => array_keys($datesGiveaway),
            'dates_ff' => array_keys($datesFf),
        ]);
    }
}
