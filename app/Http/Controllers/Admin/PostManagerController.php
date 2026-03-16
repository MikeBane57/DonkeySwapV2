<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\ShiftActivityLog;
use App\Models\SwapPost;
use App\Models\User;
use App\Models\UserHiddenPost;
use App\Models\Workgroup;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

class PostManagerController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Shift::query()
            ->whereHas('swapPosts')
            ->with([
                'user:id,name,email',
                'workgroup:id,name',
                'swapPosts' => fn ($q) => $q->with([
                    'user:id,name,email',
                    'offers.offeredBy:id,name,email',
                    'offers.offeredShift:id,position_name,start_time_utc,user_id',
                    'offers.swapPost.user:id,name,email',
                    'histories',
                ]),
            ]);

        if ($request->filled('user_id')) {
            $query->whereHas('swapPosts', fn ($q) => $q->where('user_id', $request->input('user_id')));
        }
        if ($request->filled('workgroup_id')) {
            $query->where('workgroup_id', $request->input('workgroup_id'));
        }
        if ($request->filled('status')) {
            $query->whereHas('swapPosts', fn ($q) => $q->where('status', $request->input('status')));
        }
        if ($request->filled('type')) {
            $query->whereHas('swapPosts', fn ($q) => $q->where('type', $request->input('type')));
        }
        if ($request->filled('date_from')) {
            $query->where('start_time_utc', '>=', Carbon::parse($request->input('date_from'))->startOfDay()->utc());
        }
        if ($request->filled('date_to')) {
            $query->where('start_time_utc', '<=', Carbon::parse($request->input('date_to'))->endOfDay()->utc());
        }
        if ($request->filled('min_transactions') && is_numeric($request->input('min_transactions'))) {
            $min = (int) $request->input('min_transactions');
            if ($min >= 0) {
                $shiftIdsWithMinTransactions = ShiftActivityLog::query()
                    ->where('event_type', 'assignee_changed')
                    ->select('shift_id')
                    ->groupBy('shift_id')
                    ->havingRaw('count(*) >= ?', [$min])
                    ->pluck('shift_id');
                $query->whereIn('id', $shiftIdsWithMinTransactions->isEmpty() ? [-1] : $shiftIdsWithMinTransactions);
            }
        }
        if ($request->filled('min_offers') && is_numeric($request->input('min_offers'))) {
            $minOffers = (int) $request->input('min_offers');
            if ($minOffers >= 0) {
                $query->whereRaw(
                    '(select count(*) from swap_offers so inner join swap_posts sp on so.swap_post_id = sp.id where sp.shift_id = shifts.id) >= ?',
                    [$minOffers]
                );
            }
        }
        if ($request->filled('search')) {
            $term = trim($request->input('search'));
            if ($term !== '') {
                $query->where(function ($q) use ($term) {
                    $q->where('position_name', 'like', '%'.$term.'%')
                        ->orWhereHas('swapPosts.user', fn ($uq) => $uq->where('name', 'like', '%'.$term.'%')->orWhere('email', 'like', '%'.$term.'%'));
                });
            }
        }

        $sort = $request->input('sort', 'posts_created_at');
        $dir = $request->input('dir', 'desc');
        if (! in_array($dir, ['asc', 'desc'], true)) {
            $dir = 'desc';
        }
        if ($sort === 'transaction_count') {
            $query->orderByRaw(
                '(select count(*) from shift_activity_logs where shift_activity_logs.shift_id = shifts.id and shift_activity_logs.event_type = ?) '.$dir,
                ['assignee_changed']
            );
        } elseif ($sort === 'offers_count') {
            $query->orderByRaw(
                '(select count(*) from swap_offers so inner join swap_posts sp on so.swap_post_id = sp.id where sp.shift_id = shifts.id) '.$dir
            );
        } elseif ($sort === 'view_count' || $sort === 'click_count') {
            $query->withSum('swapPosts', $sort)->orderBy('swap_posts_sum_'.$sort, $dir);
        } elseif ($sort === 'posts_created_at' || $sort === 'posts_updated_at') {
            $col = $sort === 'posts_created_at' ? 'created_at' : 'updated_at';
            $query->withMax('swapPosts', $col)->orderBy('swap_posts_max_'.$col, $dir);
        } else {
            $query->withMax('swapPosts', 'created_at')->orderBy('swap_posts_max_created_at', 'desc');
        }

        $shifts = $query->paginate(20)->withQueryString();
        $shiftIds = $shifts->getCollection()->pluck('id')->all();
        $shiftActivitiesMap = [];
        $transactionCountByShift = [];
        $hiddenByCountByShift = [];
        if (! empty($shiftIds)) {
            $hiddenByCountByShift = UserHiddenPost::query()
                ->join('swap_posts', 'swap_posts.id', '=', 'user_hidden_posts.swap_post_id')
                ->whereIn('swap_posts.shift_id', $shiftIds)
                ->selectRaw('swap_posts.shift_id as shift_id, count(distinct user_hidden_posts.user_id) as cnt')
                ->groupBy('swap_posts.shift_id')
                ->pluck('cnt', 'shift_id')
                ->all();
        }
        $typeLabel = fn (string $t) => match ($t) {
            'trade' => 'Trade',
            'time_trade' => 'Time trade',
            'cash' => 'Giveaway',
            'flight_follow' => 'Flight following',
            default => $t,
        };
        if (! empty($shiftIds)) {
            $transactionCountByShift = ShiftActivityLog::whereIn('shift_id', $shiftIds)
                ->where('event_type', 'assignee_changed')
                ->selectRaw('shift_id, count(*) as cnt')
                ->groupBy('shift_id')
                ->pluck('cnt', 'shift_id')
                ->all();
            $activities = ShiftActivityLog::whereIn('shift_id', $shiftIds)
                ->with('user:id,name,email')
                ->orderByDesc('created_at')
                ->limit(500)
                ->get();
            $userIds = $activities->pluck('user_id')->merge(
                $activities->where('event_type', 'assignee_changed')->flatMap(fn ($a) => [
                    $a->metadata['from_user_id'] ?? null,
                    $a->metadata['to_user_id'] ?? null,
                ])
            )->filter()->unique()->values()->all();
            $usersById = User::whereIn('id', $userIds)->get(['id', 'name'])->keyBy('id');
            foreach ($activities as $a) {
                $at = $a->created_at?->toIso8601String();
                $actor = $a->user?->name ?? 'System';
                $label = match ($a->event_type) {
                    'post_created' => 'Posted as '.$typeLabel((string) ($a->metadata['post_type'] ?? '')),
                    'post_removed' => 'Post removed (was '.$typeLabel((string) ($a->metadata['post_type'] ?? '')).')',
                    'assignee_changed' => 'Assignee: '.($usersById->get($a->metadata['from_user_id'] ?? 0)?->name ?? '?').' → '.($usersById->get($a->metadata['to_user_id'] ?? 0)?->name ?? '?'),
                    default => $a->event_type,
                };
                $shiftActivitiesMap[$a->shift_id] = $shiftActivitiesMap[$a->shift_id] ?? [];
                $shiftActivitiesMap[$a->shift_id][] = [
                    'at' => $at,
                    'event' => $a->event_type,
                    'label' => $label,
                    'actor' => $actor,
                ];
            }
        }

        $shifts->through(function ($shift) use ($shiftActivitiesMap, $transactionCountByShift, $hiddenByCountByShift, $typeLabel) {
            $shiftActivity = $shiftActivitiesMap[$shift->id] ?? [];
            $posts = $shift->swapPosts ?? collect();
            $types = $posts->pluck('type')->unique()->values()->all();
            $typesLabel = implode(', ', array_map($typeLabel, $types));
            $statuses = $posts->pluck('status')->unique()->values()->all();
            $statusLabel = in_array('open', $statuses) ? 'Open' : (in_array('accepted', $statuses) ? 'Accepted' : implode(', ', $statuses));
            $viewCount = $posts->sum(fn ($p) => (int) ($p->view_count ?? 0));
            $clickCount = $posts->sum(fn ($p) => (int) ($p->click_count ?? 0));
            $hiddenByCount = (int) ($hiddenByCountByShift[$shift->id] ?? 0);
            $allOffers = $posts->flatMap(fn ($p) => $p->offers ?? [])->sortByDesc('created_at')->values()->all();
            $owner = $posts->first()?->user;
            $selectedOffer = collect($allOffers)->first(fn ($o) => ($o->status ?? '') === 'selected');
            $acceptedByName = $selectedOffer?->offeredBy?->name;
            $acceptedByEmail = $selectedOffer?->offeredBy?->email;
            $editHistories = $posts->flatMap(function ($p) use ($typeLabel) {
                return collect($p->histories ?? [])->map(fn ($h) => [
                    'at' => $h->changed_at?->toIso8601String(),
                    'event' => 'edit',
                    'label' => 'Edit ('.$typeLabel($p->type ?? '').'): '.(is_array($h->changes) ? implode(', ', array_map(fn ($c) => ($c['field'] ?? '').' '.json_encode($c['old'] ?? '').' → '.json_encode($c['new'] ?? ''), $h->changes)) : ''),
                    'actor' => null,
                    'changes' => $h->changes,
                ])->all();
            })->all();
            $merged = array_merge($shiftActivity, $editHistories);
            usort($merged, fn ($x, $y) => strcmp($y['at'] ?? '', $x['at'] ?? ''));

            $cashAmount = $posts->first(fn ($p) => $p->cash_amount !== null && (float) $p->cash_amount > 0)?->cash_amount;
            $flightFollowMinutes = $posts->first(fn ($p) => $p->flight_follow_minutes !== null)?->flight_follow_minutes;
            $notes = $posts->first(fn ($p) => ! empty($p->notes))?->notes;

            // Each time this shift’s post was accepted: who posted, who accepted, cash if applicable
            return [
                'shift_id' => $shift->id,
                'post_ids' => $posts->pluck('id')->values()->all(),
                'owner_name' => $owner?->name,
                'owner_email' => $owner?->email,
                'owner_id' => $owner?->id,
                'accepted_by_name' => $acceptedByName,
                'accepted_by_email' => $acceptedByEmail,
                'types' => $types,
                'types_label' => $typesLabel,
                'status' => $statusLabel,
                'statuses' => $statuses,
                'cash_amount' => $cashAmount,
                'flight_follow_minutes' => $flightFollowMinutes,
                'notes' => $notes,
                'view_count' => $viewCount,
                'click_count' => $clickCount,
                'hidden_by_count' => $hiddenByCount,
                'transaction_count' => (int) ($transactionCountByShift[$shift->id] ?? 0),
                'offers_count' => count($allOffers),
                'posts_created_at' => $posts->max('created_at')?->toIso8601String(),
                'posts_updated_at' => $posts->max('updated_at')?->toIso8601String(),
                'shift' => [
                    'id' => $shift->id,
                    'position_name' => $shift->position_name,
                    'desk_type' => $shift->desk_type,
                    'start_time_utc' => $shift->start_time_utc?->toIso8601String(),
                    'end_time_utc' => $shift->end_time_utc?->toIso8601String(),
                    'regulatory' => $shift->regulatory,
                    'workgroup_name' => $shift->workgroup?->name,
                    'assignee_id' => $shift->user_id,
                    'assignee_name' => $shift->user?->name,
                    'assignee_email' => $shift->user?->email,
                ],
                'posts' => $posts->map(fn ($p) => [
                    'id' => $p->id,
                    'type' => $p->type,
                    'type_label' => $typeLabel($p->type ?? ''),
                    'status' => $p->status,
                    'cash_amount' => $p->cash_amount,
                    'flight_follow_minutes' => $p->flight_follow_minutes,
                    'notes' => $p->notes,
                ])->values()->all(),
                'offers' => array_map(function ($o) use ($typeLabel) {
                    $post = $o->swapPost;
                    $status = $o->status ?? '';
                    $displayStatus = $status === 'selected' ? 'accepted' : $status;
                    $shiftGoingToName = $status === 'selected' ? ($o->offeredBy?->name ?? null) : null;

                    return [
                        'id' => $o->id,
                        'offered_by_id' => $o->offered_by_user_id,
                        'offered_by_name' => $o->offeredBy?->name,
                        'offered_by_email' => $o->offeredBy?->email,
                        'offered_shift_id' => $o->offered_shift_id,
                        'offered_shift_summary' => $o->offeredShift
                            ? $o->offeredShift->position_name.' · '.($o->offeredShift->start_time_utc ? $o->offeredShift->start_time_utc->format('M j, g:i A') : '')
                            : null,
                        'status' => $displayStatus,
                        'status_raw' => $status,
                        'response_notes' => $o->response_notes,
                        'created_at' => $o->created_at?->toIso8601String(),
                        'poster_name' => $post?->user?->name,
                        'poster_email' => $post?->user?->email,
                        'shift_going_to_name' => $shiftGoingToName,
                        'cash_amount' => $post && $post->cash_amount !== null ? (float) $post->cash_amount : null,
                        'post_type_label' => $post ? $typeLabel($post->type ?? '') : null,
                    ];
                }, $allOffers),
                'activity' => $merged,
            ];
        });

        $users = User::orderBy('name')->get(['id', 'name', 'email'])->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
        ]);
        $workgroups = Workgroup::orderBy('name')->get(['id', 'name'])->map(fn ($wg) => [
            'id' => $wg->id,
            'name' => $wg->name,
        ]);

        $statusOptions = [['value' => '__all__', 'label' => 'Any status']];
        foreach (SwapPost::distinct()->pluck('status')->filter()->sort()->values() as $s) {
            $statusOptions[] = ['value' => $s, 'label' => ucfirst(strtolower($s))];
        }

        return Inertia::render('admin/posts', [
            'posts' => $shifts,
            'users' => $users,
            'workgroups' => $workgroups,
            'status_options' => $statusOptions,
            'filters' => $request->only(['user_id', 'workgroup_id', 'status', 'type', 'date_from', 'date_to', 'min_transactions', 'min_offers', 'search']),
            'sort' => $sort,
            'dir' => $dir,
        ]);
    }

    public function update(Request $request, SwapPost $post): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => ['required', 'string', 'in:open,closed,cancelled'],
        ]);
        if ($validator->fails()) {
            return redirect()->back()->withErrors($validator);
        }
        $post->update(['status' => $request->input('status')]);

        return redirect()->back()->with('success', 'Post status updated.');
    }

    public function destroy(SwapPost $post): RedirectResponse
    {
        $post->delete();

        return redirect()->back()->with('success', 'Post removed.');
    }

    public function updateShiftPostsStatus(Request $request, Shift $shift): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => ['required', 'string', 'in:open,closed,cancelled'],
        ]);
        if ($validator->fails()) {
            return redirect()->back()->withErrors($validator);
        }
        $shift->swapPosts()->update(['status' => $request->input('status')]);

        return redirect()->back()->with('success', 'All posts for this shift updated.');
    }

    public function destroyShiftPosts(Shift $shift): RedirectResponse
    {
        $shift->swapPosts()->delete();

        return redirect()->back()->with('success', 'All posts for this shift removed.');
    }
}
