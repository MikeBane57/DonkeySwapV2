<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\LookingForWorkOffer;
use App\Models\LookingForWorkPost;
use App\Models\LookingForWorkPostHistory;
use App\Models\Shift;
use App\Models\ShiftActivityLog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LookingForWorkController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $now = Carbon::now()->utc();

        $query = LookingForWorkPost::with(['user:id,name', 'offers.offeredBy:id,name', 'offers.offeredShift.workgroup:id,name'])
            ->where('status', 'open')
            ->where('seeking_date', '>=', $now->toDateString())
            ->where('user_id', '!=', $user->id);

        if ($request->filled('date_from')) {
            $query->where('seeking_date', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('seeking_date', '<=', $request->input('date_to'));
        }
        if ($request->filled('workgroup_id')) {
            $wgId = (int) $request->input('workgroup_id');
            $query->whereHas('user.workgroups', fn ($q) => $q->where('workgroups.id', $wgId));
        }
        if ($request->filled('min_cash') && is_numeric($request->input('min_cash'))) {
            $query->where('seeking_cash', '>=', (float) $request->input('min_cash'));
        }

        $posts = $query->orderBy('seeking_date')->orderBy('created_at')->get();

        // Increment view_count for admin post manager stats
        $postIds = $posts->pluck('id')->filter()->values()->all();
        if ($postIds !== []) {
            LookingForWorkPost::whereIn('id', $postIds)->increment('view_count');
        }

        if ($request->filled('desk_type') && trim($request->input('desk_type')) !== '') {
            $deskType = trim($request->input('desk_type'));
            $posts = $posts->filter(function (LookingForWorkPost $post) use ($deskType) {
                $types = $post->seeking_desk_types;
                return $types === null || $types === [] || in_array($deskType, $types, true);
            })->values();
        }

        // Pending offer count per post (for "has offer(s)" badge)
        $postIds = $posts->pluck('id')->all();
        $pendingCountByPostId = [];
        if ($postIds !== []) {
            $pendingCountByPostId = LookingForWorkOffer::whereIn('looking_for_work_post_id', $postIds)
                ->where('status', 'pending')
                ->selectRaw('looking_for_work_post_id, count(*) as c')
                ->groupBy('looking_for_work_post_id')
                ->pluck('c', 'looking_for_work_post_id')
                ->all();
        }

        $items = $posts->map(function (LookingForWorkPost $post) use ($user, $pendingCountByPostId) {
            $pendingCount = (int) ($pendingCountByPostId[$post->id] ?? 0);
            $myOffer = $post->offers->firstWhere('offered_by_user_id', $user->id);
            return [
                'id' => $post->id,
                'user_id' => $post->user_id,
                'poster_name' => $post->user?->name,
                'seeking_date' => $post->seeking_date->format('Y-m-d'),
                'seeking_desk_types' => $post->seeking_desk_types ?? [],
                'seeking_cash' => $post->seeking_cash ? (float) $post->seeking_cash : 0,
                'seeking_obo' => (bool) $post->seeking_obo,
                'status' => $post->status,
                'notes' => $post->notes,
                'pending_offer_count' => $pendingCount,
                'is_mine' => $post->user_id === $user->id,
                'my_offer' => $myOffer ? [
                    'id' => $myOffer->id,
                    'offered_shift_id' => $myOffer->offered_shift_id,
                    'offered_cash' => $myOffer->offered_cash ? (float) $myOffer->offered_cash : null,
                    'response_notes' => $myOffer->response_notes,
                ] : null,
                'offers' => $post->offers->where('status', 'pending')->values()->map(fn (LookingForWorkOffer $o) => [
                    'id' => $o->id,
                    'offered_by_user_id' => $o->offered_by_user_id,
                    'offered_by_name' => $o->offeredBy?->name,
                    'offered_shift_id' => $o->offered_shift_id,
                    'offered_cash' => $o->offered_cash ? (float) $o->offered_cash : null,
                    'response_notes' => $o->response_notes,
                    'shift_summary' => $o->offeredShift ? [
                        'position_name' => $o->offeredShift->position_name,
                        'desk_type' => $o->offeredShift->desk_type,
                        'start_time_utc' => $o->offeredShift->start_time_utc?->toIso8601String(),
                        'end_time_utc' => $o->offeredShift->end_time_utc?->toIso8601String(),
                        'workgroup_name' => $o->offeredShift->workgroup?->name,
                    ] : null,
                ])->all(),
            ];
        })->values()->all();

        $userShiftsByDate = Shift::where('user_id', $user->id)
            ->where('start_time_utc', '>', $now)
            ->with('workgroup:id,name')
            ->get()
            ->groupBy(fn (Shift $s) => $s->start_time_utc->format('Y-m-d'));

        $workgroups = $user->workgroups()->with('deskTypes')->orderBy('name')->get()
            ->map(fn ($wg) => [
                'id' => $wg->id,
                'name' => $wg->name,
                'desk_types' => $wg->deskTypes->map(fn ($d) => ['code' => $d->code, 'label' => $d->label])->values()->all(),
            ])->values()->all();

        return Inertia::render('app/looking-for-work', [
            'posts' => $items,
            'workgroups' => $workgroups,
            'myShiftsByDate' => $userShiftsByDate->map(fn ($shifts) => $shifts->map(fn (Shift $s) => [
                'id' => $s->id,
                'position_name' => $s->position_name,
                'desk_type' => $s->desk_type,
                'start_time_utc' => $s->start_time_utc->toIso8601String(),
                'end_time_utc' => $s->end_time_utc->toIso8601String(),
                'workgroup_name' => $s->workgroup?->name,
            ])->values()->all())->all(),
            'filters' => $request->only(['date_from', 'date_to', 'workgroup_id', 'desk_type', 'min_cash']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'seeking_date' => ['required', 'date', 'after_or_equal:today'],
            'seeking_desk_types' => ['nullable', 'array'],
            'seeking_desk_types.*' => ['string', 'max:50'],
            'seeking_cash' => ['required', 'numeric', 'min:0'],
            'seeking_obo' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $user = $request->user();

        $post = LookingForWorkPost::create([
            'user_id' => $user->id,
            'seeking_date' => $request->input('seeking_date'),
            'seeking_desk_types' => $request->input('seeking_desk_types') ?: null,
            'seeking_cash' => $request->input('seeking_cash'),
            'seeking_obo' => $request->boolean('seeking_obo'),
            'notes' => $request->input('notes'),
        ]);

        return response()->json(['ok' => true, 'post' => [
            'id' => $post->id,
            'seeking_date' => $post->seeking_date->format('Y-m-d'),
            'seeking_desk_types' => $post->seeking_desk_types ?? [],
            'seeking_cash' => (float) $post->seeking_cash,
            'seeking_obo' => $post->seeking_obo,
            'status' => $post->status,
        ]]);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => ['required', 'date', 'after_or_equal:today'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'seeking_desk_types' => ['nullable', 'array'],
            'seeking_desk_types.*' => ['string', 'max:50'],
            'seeking_cash' => ['required', 'numeric', 'min:0'],
            'seeking_obo' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $user = $request->user();
        $from = Carbon::parse($request->input('date_from'))->startOfDay()->utc();
        $to = Carbon::parse($request->input('date_to'))->startOfDay()->utc();
        $now = Carbon::now()->utc()->startOfDay();
        if ($to->lt($from)) {
            return response()->json(['message' => 'Invalid date range.'], 422);
        }
        $days = [];
        for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
            if ($d->gte($now)) {
                $days[] = $d->copy()->format('Y-m-d');
            }
        }
        if (count($days) > 90) {
            return response()->json(['message' => 'Maximum 90 days per bulk create.'], 422);
        }
        $deskTypes = $request->input('seeking_desk_types') ?: null;
        $cash = (float) $request->input('seeking_cash');
        $obo = $request->boolean('seeking_obo');
        $notes = $request->input('notes');

        $created = [];
        foreach ($days as $dateStr) {
            $post = LookingForWorkPost::create([
                'user_id' => $user->id,
                'seeking_date' => $dateStr,
                'seeking_desk_types' => $deskTypes,
                'seeking_cash' => $cash,
                'seeking_obo' => $obo,
                'status' => 'open',
                'notes' => $notes,
            ]);
            $created[] = ['id' => $post->id, 'seeking_date' => $dateStr];
        }

        return response()->json(['ok' => true, 'created' => $created, 'count' => count($created)]);
    }

    public function update(Request $request, LookingForWorkPost $looking_for_work_post): JsonResponse
    {
        $post = $looking_for_work_post;
        if ($post->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($post->status !== 'open') {
            return response()->json(['message' => 'This post is no longer open.'], 422);
        }
        $request->validate([
            'seeking_date' => ['sometimes', 'date', 'after_or_equal:today'],
            'seeking_desk_types' => ['nullable', 'array'],
            'seeking_desk_types.*' => ['string', 'max:50'],
            'seeking_cash' => ['sometimes', 'numeric', 'min:0'],
            'seeking_obo' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        if ($request->has('seeking_date')) {
            $post->seeking_date = $request->input('seeking_date');
        }
        if ($request->has('seeking_desk_types')) {
            $post->seeking_desk_types = $request->input('seeking_desk_types') ?: null;
        }
        if ($request->has('seeking_cash')) {
            $post->seeking_cash = $request->input('seeking_cash');
        }
        if ($request->has('seeking_obo')) {
            $post->seeking_obo = $request->boolean('seeking_obo');
        }
        if (array_key_exists('notes', $request->all())) {
            $post->notes = $request->input('notes');
        }

        $changes = [];
        if ($request->has('seeking_date') && $post->getOriginal('seeking_date') != $post->seeking_date) {
            $changes[] = ['field' => 'seeking_date', 'old' => $post->getOriginal('seeking_date'), 'new' => $post->seeking_date?->format('Y-m-d')];
        }
        if ($request->has('seeking_cash') && (float) $post->getOriginal('seeking_cash') !== (float) $post->seeking_cash) {
            $changes[] = ['field' => 'seeking_cash', 'old' => $post->getOriginal('seeking_cash'), 'new' => $post->seeking_cash];
        }
        if ($request->has('seeking_obo') && (bool) $post->getOriginal('seeking_obo') !== (bool) $post->seeking_obo) {
            $changes[] = ['field' => 'seeking_obo', 'old' => $post->getOriginal('seeking_obo'), 'new' => $post->seeking_obo];
        }
        if (array_key_exists('notes', $request->all()) && ($post->getOriginal('notes') ?? '') !== ($post->notes ?? '')) {
            $changes[] = ['field' => 'notes', 'old' => $post->getOriginal('notes'), 'new' => $post->notes];
        }
        if ($request->has('seeking_desk_types')) {
            $old = $post->getOriginal('seeking_desk_types');
            $new = $post->seeking_desk_types;
            if (json_encode($old) !== json_encode($new)) {
                $changes[] = ['field' => 'seeking_desk_types', 'old' => $old, 'new' => $new];
            }
        }
        if (\count($changes) > 0) {
            LookingForWorkPostHistory::create([
                'looking_for_work_post_id' => $post->id,
                'user_id' => $request->user()->id,
                'changes' => $changes,
                'changed_at' => Carbon::now()->utc(),
            ]);
        }
        $post->save();

        return response()->json(['ok' => true, 'post' => [
            'id' => $post->id,
            'seeking_date' => $post->seeking_date->format('Y-m-d'),
            'seeking_desk_types' => $post->seeking_desk_types ?? [],
            'seeking_cash' => (float) $post->seeking_cash,
            'seeking_obo' => $post->seeking_obo,
            'notes' => $post->notes,
        ]]);
    }

    public function destroy(Request $request, LookingForWorkPost $looking_for_work_post): JsonResponse
    {
        $post = $looking_for_work_post;
        if ($post->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $pendingOffers = $post->pendingOffers()->get();
        foreach ($pendingOffers as $offer) {
            $offer->update(['status' => 'rejected']);
            AppNotification::create([
                'user_id' => $offer->offered_by_user_id,
                'type' => 'looking_for_work_rejected',
                'data' => [
                    'looking_for_work_post_id' => $post->id,
                    'message' => 'The looking-for-work post you responded to was removed.',
                ],
            ]);
        }
        $post->delete();

        return response()->json(['ok' => true]);
    }

    public function offer(Request $request, LookingForWorkPost $looking_for_work_post): JsonResponse
    {
        $post = $looking_for_work_post;
        if ($post->status !== 'open') {
            return response()->json(['message' => 'This post is no longer open.'], 422);
        }
        if ($post->user_id === $request->user()->id) {
            return response()->json(['message' => 'You cannot offer on your own post.'], 422);
        }
        $request->validate([
            'offered_shift_id' => ['required', 'integer', 'exists:shifts,id'],
            'offered_cash' => ['nullable', 'numeric', 'min:0'],
            'response_notes' => ['nullable', 'string', 'max:500'],
        ]);
        $user = $request->user();
        $shift = Shift::findOrFail($request->input('offered_shift_id'));
        if ($shift->user_id !== $user->id) {
            return response()->json(['message' => 'You can only offer your own shift.'], 422);
        }
        $shiftDate = $shift->start_time_utc->format('Y-m-d');
        if ($shiftDate !== $post->seeking_date->format('Y-m-d')) {
            return response()->json(['message' => 'Your shift must be on the same date as the post.'], 422);
        }
        if (LookingForWorkOffer::where('looking_for_work_post_id', $post->id)->where('offered_by_user_id', $user->id)->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'You already have a pending offer on this post.'], 422);
        }
        $offeredCash = $request->has('offered_cash') && $request->input('offered_cash') !== '' && $request->input('offered_cash') !== null
            ? (float) $request->input('offered_cash')
            : null;
        if (! $post->seeking_obo && $offeredCash !== null) {
            $offeredCash = null;
        }

        $offer = LookingForWorkOffer::create([
            'looking_for_work_post_id' => $post->id,
            'offered_by_user_id' => $user->id,
            'offered_shift_id' => $shift->id,
            'offered_cash' => $offeredCash,
            'response_notes' => $request->input('response_notes'),
        ]);

        $post->increment('click_count');

        AppNotification::create([
            'user_id' => $post->user_id,
            'type' => 'looking_for_work_offer',
            'data' => [
                'looking_for_work_post_id' => $post->id,
                'looking_for_work_offer_id' => $offer->id,
                'message' => $user->name . ' offered a shift for your looking-for-work post.',
            ],
        ]);

        return response()->json(['ok' => true, 'offer_id' => $offer->id]);
    }

    public function acceptOffer(Request $request, LookingForWorkOffer $looking_for_work_offer): JsonResponse
    {
        $offer = $looking_for_work_offer;
        $offer->load(['post.user', 'offeredShift', 'offeredBy']);
        $post = $offer->post;
        if (! $post || $post->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($post->status !== 'open') {
            return response()->json(['message' => 'This post is no longer open.'], 422);
        }
        if ($offer->status !== 'pending') {
            return response()->json(['message' => 'This offer is no longer valid.'], 422);
        }

        $shift = $offer->offeredShift;
        $posterUserId = $post->user_id;
        $offererUserId = $offer->offered_by_user_id;

        ShiftActivityLog::create([
            'shift_id' => $shift->id,
            'event_type' => 'assignee_changed',
            'metadata' => ['from_user_id' => $offererUserId, 'to_user_id' => $posterUserId],
            'user_id' => $posterUserId,
            'swap_post_id' => null,
            'swap_offer_id' => null,
        ]);

        $shift->user_id = $posterUserId;
        $shift->save();

        $offer->status = 'selected';
        $offer->save();
        $post->status = 'accepted';
        $post->save();

        $rejectedOffers = LookingForWorkOffer::where('looking_for_work_post_id', $post->id)
            ->where('id', '!=', $offer->id)
            ->where('status', 'pending')
            ->get();
        LookingForWorkOffer::where('looking_for_work_post_id', $post->id)
            ->where('id', '!=', $offer->id)
            ->where('status', 'pending')
            ->update(['status' => 'rejected']);

        foreach ($rejectedOffers as $rejected) {
            AppNotification::create([
                'user_id' => $rejected->offered_by_user_id,
                'type' => 'looking_for_work_not_selected',
                'data' => [
                    'looking_for_work_post_id' => $post->id,
                    'message' => 'Another offer was accepted on the post you responded to.',
                ],
            ]);
        }

        AppNotification::create([
            'user_id' => $offer->offered_by_user_id,
            'type' => 'looking_for_work_accepted',
            'data' => [
                'looking_for_work_post_id' => $post->id,
                'looking_for_work_offer_id' => $offer->id,
                'message' => 'Your offer was accepted. The shift has been transferred.',
            ],
        ]);

        return response()->json(['ok' => true, 'message' => 'Offer accepted. The shift has been transferred to you.']);
    }

    public function rejectOffer(Request $request, LookingForWorkOffer $looking_for_work_offer): JsonResponse
    {
        $offer = $looking_for_work_offer;
        $offer->load('post');
        $post = $offer->post;
        if (! $post || $post->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($offer->status !== 'pending') {
            return response()->json(['message' => 'This offer is no longer valid.'], 422);
        }
        $offer->status = 'rejected';
        $offer->save();

        AppNotification::create([
            'user_id' => $offer->offered_by_user_id,
            'type' => 'looking_for_work_rejected',
            'data' => [
                'looking_for_work_post_id' => $post->id,
                'message' => 'Your offer was declined.',
            ],
        ]);

        return response()->json(['ok' => true]);
    }

    public function withdrawOffer(Request $request, LookingForWorkOffer $looking_for_work_offer): JsonResponse
    {
        $offer = $looking_for_work_offer;
        if ($offer->offered_by_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($offer->status !== 'pending') {
            return response()->json(['message' => 'This offer is no longer pending.'], 422);
        }
        $offer->status = 'withdrawn';
        $offer->save();

        return response()->json(['ok' => true]);
    }

    public function updateOffer(Request $request, LookingForWorkOffer $looking_for_work_offer): JsonResponse
    {
        $offer = $looking_for_work_offer;
        if ($offer->offered_by_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($offer->status !== 'pending') {
            return response()->json(['message' => 'This offer is no longer pending.'], 422);
        }
        $post = $offer->post;
        if (! $post || $post->status !== 'open') {
            return response()->json(['message' => 'The post is no longer open.'], 422);
        }
        $request->validate([
            'offered_shift_id' => ['sometimes', 'integer', 'exists:shifts,id'],
            'offered_cash' => ['nullable', 'numeric', 'min:0'],
            'response_notes' => ['nullable', 'string', 'max:500'],
        ]);
        $user = $request->user();
        if ($request->has('offered_shift_id')) {
            $shift = Shift::findOrFail($request->input('offered_shift_id'));
            if ($shift->user_id !== $user->id) {
                return response()->json(['message' => 'You can only offer your own shift.'], 422);
            }
            if ($shift->start_time_utc->format('Y-m-d') !== $post->seeking_date->format('Y-m-d')) {
                return response()->json(['message' => 'Your shift must be on the same date as the post.'], 422);
            }
            $offer->offered_shift_id = $shift->id;
        }
        if (array_key_exists('offered_cash', $request->all())) {
            $offer->offered_cash = $request->input('offered_cash') !== '' && $request->input('offered_cash') !== null
                ? (float) $request->input('offered_cash')
                : null;
        }
        if (array_key_exists('response_notes', $request->all())) {
            $offer->response_notes = $request->input('response_notes');
        }
        $offer->save();

        return response()->json(['ok' => true]);
    }
}
