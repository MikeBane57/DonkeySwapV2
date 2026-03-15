<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Shift;
use App\Models\ShiftActivityLog;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use App\Models\SwapPostHistory;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SwapPostController extends Controller
{
    /**
     * Create, update, or delete swap posts for one of the user's shifts.
     * Body: { postings: [{ type, cash_amount?, flight_follow_minutes?, notes? }], delete_ids: [id, ...] }
     * type: trade | cash | flight_follow
     * Trade and giveaway are one "post" per shift; flight_follow is separate. A shift cannot have both (trade/cash and flight_follow).
     */
    public function store(Request $request, Shift $shift): JsonResponse
    {
        $user = $request->user();
        if ($shift->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'postings' => ['present', 'array'],
            'postings.*.type' => ['required', 'string', 'in:trade,cash,flight_follow,time_trade'],
            'postings.*.cash_amount' => ['nullable', 'numeric', 'min:0'],
            'postings.*.flight_follow_minutes' => ['nullable', 'integer', 'min:1', 'max:600'],
            'postings.*.flight_follow_at' => ['nullable', 'string', 'in:beginning,end'],
            'postings.*.notes' => ['nullable', 'string', 'max:1000'],
            'postings.*.preferred_start_times' => ['nullable', 'array'],
            'postings.*.preferred_start_times.*' => ['string', 'regex:/^\d{1,2}:\d{2}$/'],
            'delete_ids' => ['sometimes', 'array'],
            'delete_ids.*' => ['integer', 'exists:swap_posts,id'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $postings = $request->input('postings', []);
        $postingTypes = collect($postings)->pluck('type')->unique()->values()->all();
        $hasTradeOrCash = in_array('trade', $postingTypes) || in_array('cash', $postingTypes);
        $hasFlightFollow = in_array('flight_follow', $postingTypes);
        $hasTimeTrade = in_array('time_trade', $postingTypes);
        if ($hasTradeOrCash && ($hasFlightFollow || $hasTimeTrade)) {
            return response()->json(['errors' => ['postings' => ['A shift cannot have both trade/giveaway and flight following or time trade. Choose one.']]], 422);
        }
        if ($hasFlightFollow && $hasTimeTrade) {
            return response()->json(['errors' => ['postings' => ['A shift cannot have both flight following and time trade. Choose one.']]], 422);
        }

        $existingOnShift = SwapPost::where('shift_id', $shift->id)->where('user_id', $user->id)->get();
        $idsToDelete = $request->input('delete_ids', []);
        if ($hasFlightFollow || $hasTimeTrade) {
            $idsToDelete = array_merge($idsToDelete, $existingOnShift->whereIn('type', ['trade', 'cash'])->pluck('id')->all());
        }
        if ($hasTradeOrCash) {
            $idsToDelete = array_merge($idsToDelete, $existingOnShift->whereIn('type', ['flight_follow', 'time_trade'])->pluck('id')->all());
        }
        if ($hasFlightFollow) {
            $idsToDelete = array_merge($idsToDelete, $existingOnShift->where('type', 'time_trade')->pluck('id')->all());
        }
        if ($hasTimeTrade) {
            $idsToDelete = array_merge($idsToDelete, $existingOnShift->where('type', 'flight_follow')->pluck('id')->all());
        }
        $deleteIds = array_values(array_unique($idsToDelete));
        $myPostIds = SwapPost::whereIn('id', $deleteIds)->where('user_id', $user->id)->pluck('id')->toArray();
        $postsToRemove = SwapPost::whereIn('id', $myPostIds)->get();
        foreach ($postsToRemove as $removed) {
            ShiftActivityLog::create([
                'shift_id' => $shift->id,
                'event_type' => 'post_removed',
                'metadata' => ['post_type' => $removed->type],
                'user_id' => $user->id,
                'swap_post_id' => $removed->id,
            ]);
        }
        SwapPost::whereIn('id', $myPostIds)->delete();

        foreach ($postings as $p) {
            $existing = SwapPost::where('shift_id', $shift->id)
                ->where('user_id', $user->id)
                ->where('type', $p['type'])
                ->first();

            $newCash = isset($p['cash_amount']) && $p['cash_amount'] > 0 ? (float) $p['cash_amount'] : null;
            $newFf = isset($p['flight_follow_minutes']) ? (int) $p['flight_follow_minutes'] : null;
            $newFfAt = isset($p['flight_follow_at']) && in_array($p['flight_follow_at'], ['beginning', 'end'], true) ? $p['flight_follow_at'] : null;
            $newNotes = isset($p['notes']) && $p['notes'] !== '' ? (string) $p['notes'] : null;
            $newPreferred = null;
            if ($p['type'] === 'time_trade' && ! empty($p['preferred_start_times']) && is_array($p['preferred_start_times'])) {
                $newPreferred = array_values(array_map(function ($t) {
                    $parts = explode(':', (string) $t, 2);
                    return sprintf('%02d:%02d', (int) ($parts[0] ?? 0), (int) ($parts[1] ?? 0));
                }, $p['preferred_start_times']));
            }

            $data = [
                'shift_id' => $shift->id,
                'user_id' => $user->id,
                'type' => $p['type'],
                'status' => 'open',
                'cash_amount' => $newCash,
                'flight_follow_minutes' => $newFf,
                'flight_follow_at' => $newFfAt,
                'notes' => $newNotes,
                'preferred_start_times' => $newPreferred,
            ];
            if ($existing) {
                $changes = $this->postChanges($existing, $newCash, $newFf, $newFfAt, $newNotes, $newPreferred);
                if (! empty($changes)) {
                    SwapPostHistory::create([
                        'swap_post_id' => $existing->id,
                        'user_id' => $user->id,
                        'changes' => $changes,
                        'changed_at' => Carbon::now()->utc(),
                    ]);
                }
                $existing->update($data);
            } else {
                $newPost = SwapPost::create($data);
                ShiftActivityLog::create([
                    'shift_id' => $shift->id,
                    'event_type' => 'post_created',
                    'metadata' => ['post_type' => $newPost->type],
                    'user_id' => $user->id,
                    'swap_post_id' => $newPost->id,
                ]);
            }
        }

        return response()->json(['ok' => true]);
    }

    /** @return array<int, array{field: string, old: mixed, new: mixed}> */
    private function postChanges(SwapPost $post, ?float $newCash, ?int $newFf, ?string $newFfAt, ?string $newNotes, ?array $newPreferred = null): array
    {
        $changes = [];
        $oldCash = $post->cash_amount !== null ? (float) $post->cash_amount : null;
        if ($oldCash !== $newCash) {
            $changes[] = ['field' => 'cash_amount', 'old' => $oldCash, 'new' => $newCash];
        }
        $oldFf = $post->flight_follow_minutes;
        if ($oldFf !== $newFf) {
            $changes[] = ['field' => 'flight_follow_minutes', 'old' => $oldFf, 'new' => $newFf];
        }
        $oldFfAt = $post->flight_follow_at;
        if ($oldFfAt !== $newFfAt) {
            $changes[] = ['field' => 'flight_follow_at', 'old' => $oldFfAt, 'new' => $newFfAt];
        }
        $oldNotes = $post->notes;
        if ((string) $oldNotes !== (string) $newNotes) {
            $changes[] = ['field' => 'notes', 'old' => $oldNotes, 'new' => $newNotes];
        }
        $oldPreferred = $post->preferred_start_times;
        if (json_encode($oldPreferred) !== json_encode($newPreferred)) {
            $changes[] = ['field' => 'preferred_start_times', 'old' => $oldPreferred, 'new' => $newPreferred];
        }
        return $changes;
    }

    /**
     * Create the same postings for multiple shifts (bulk post).
     * Body: { shift_ids: [1,2,3], postings: [{ type, cash_amount?, flight_follow_minutes?, notes? }] }
     */
    public function storeBulk(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'shift_ids' => ['required', 'array', 'min:1'],
            'shift_ids.*' => ['integer', 'exists:shifts,id'],
            'postings' => ['required', 'array', 'min:1'],
            'postings.*.type' => ['required', 'string', 'in:trade,cash,flight_follow,time_trade'],
            'postings.*.cash_amount' => ['nullable', 'numeric', 'min:0'],
            'postings.*.flight_follow_minutes' => ['nullable', 'integer', 'min:1', 'max:600'],
            'postings.*.flight_follow_at' => ['nullable', 'string', 'in:beginning,end'],
            'postings.*.notes' => ['nullable', 'string', 'max:1000'],
            'postings.*.preferred_start_times' => ['nullable', 'array'],
            'postings.*.preferred_start_times.*' => ['string', 'regex:/^\d{1,2}:\d{2}$/'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $shiftIds = $request->input('shift_ids');
        $shifts = Shift::whereIn('id', $shiftIds)->where('user_id', $user->id)->pluck('id')->toArray();
        if (count($shifts) !== count($shiftIds)) {
            return response()->json(['message' => 'Some shifts not found or not yours.'], 403);
        }

        $postings = $request->input('postings', []);
        $postingTypes = collect($postings)->pluck('type')->unique()->values()->all();
        $hasTradeOrCash = in_array('trade', $postingTypes) || in_array('cash', $postingTypes);
        $hasFlightFollow = in_array('flight_follow', $postingTypes);
        $hasTimeTrade = in_array('time_trade', $postingTypes);
        if ($hasTradeOrCash && ($hasFlightFollow || $hasTimeTrade)) {
            return response()->json(['errors' => ['postings' => ['Cannot combine trade/giveaway with flight following or time trade. Choose one.']]], 422);
        }
        if ($hasFlightFollow && $hasTimeTrade) {
            return response()->json(['errors' => ['postings' => ['Cannot combine flight following with time trade. Choose one.']]], 422);
        }
        foreach ($shifts as $shiftId) {
            $existingOnShift = SwapPost::where('shift_id', $shiftId)->where('user_id', $user->id)->get();
            $toDelete = [];
            if ($hasFlightFollow || $hasTimeTrade) {
                $toDelete = array_merge($toDelete, $existingOnShift->whereIn('type', ['trade', 'cash'])->pluck('id')->all());
            }
            if ($hasTradeOrCash) {
                $toDelete = array_merge($toDelete, $existingOnShift->whereIn('type', ['flight_follow', 'time_trade'])->pluck('id')->all());
            }
            if ($hasFlightFollow) {
                $toDelete = array_merge($toDelete, $existingOnShift->where('type', 'time_trade')->pluck('id')->all());
            }
            if ($hasTimeTrade) {
                $toDelete = array_merge($toDelete, $existingOnShift->where('type', 'flight_follow')->pluck('id')->all());
            }
            $toDelete = array_values(array_unique($toDelete));
            if (! empty($toDelete)) {
                $toRemove = SwapPost::whereIn('id', $toDelete)->get();
                foreach ($toRemove as $removed) {
                    ShiftActivityLog::create([
                        'shift_id' => $shiftId,
                        'event_type' => 'post_removed',
                        'metadata' => ['post_type' => $removed->type],
                        'user_id' => $user->id,
                        'swap_post_id' => $removed->id,
                    ]);
                }
                SwapPost::whereIn('id', $toDelete)->delete();
            }
            foreach ($postings as $p) {
                $existing = SwapPost::where('shift_id', $shiftId)
                    ->where('user_id', $user->id)
                    ->where('type', $p['type'])
                    ->first();
                $preferred = null;
                if ($p['type'] === 'time_trade' && ! empty($p['preferred_start_times']) && is_array($p['preferred_start_times'])) {
                    $preferred = array_values(array_map(function ($t) {
                        $parts = explode(':', (string) $t, 2);
                        return sprintf('%02d:%02d', (int) ($parts[0] ?? 0), (int) ($parts[1] ?? 0));
                    }, $p['preferred_start_times']));
                }
                $data = [
                    'shift_id' => $shiftId,
                    'user_id' => $user->id,
                    'type' => $p['type'],
                    'status' => 'open',
                    'cash_amount' => isset($p['cash_amount']) && $p['cash_amount'] > 0 ? $p['cash_amount'] : null,
                    'flight_follow_minutes' => $p['flight_follow_minutes'] ?? null,
                    'flight_follow_at' => isset($p['flight_follow_at']) && in_array($p['flight_follow_at'], ['beginning', 'end'], true) ? $p['flight_follow_at'] : null,
                    'notes' => $p['notes'] ?? null,
                    'preferred_start_times' => $preferred,
                ];
                if ($existing) {
                    $existing->update($data);
                } else {
                    $newPost = SwapPost::create($data);
                    ShiftActivityLog::create([
                        'shift_id' => $shiftId,
                        'event_type' => 'post_created',
                        'metadata' => ['post_type' => $newPost->type],
                        'user_id' => $user->id,
                        'swap_post_id' => $newPost->id,
                    ]);
                }
            }
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Get edit history for all posts on a shift (for the current user's posts).
     */
    public function history(Request $request, Shift $shift): JsonResponse
    {
        if ($shift->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $posts = SwapPost::where('shift_id', $shift->id)->where('user_id', $request->user()->id)->pluck('id');
        $histories = SwapPostHistory::whereIn('swap_post_id', $posts)
            ->with('swapPost:id,type')
            ->orderByDesc('changed_at')
            ->limit(50)
            ->get()
            ->map(fn ($h) => [
                'id' => $h->id,
                'swap_post_id' => $h->swap_post_id,
                'post_type' => $h->swapPost?->type,
                'changed_at' => $h->changed_at?->toIso8601String(),
                'changes' => $h->changes,
            ]);
        return response()->json(['history' => $histories]);
    }

    public function destroy(Request $request, SwapPost $post): JsonResponse
    {
        if ($post->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $shiftId = $post->shift_id;
        $postType = $post->type;
        $userId = $request->user()->id;
        $post->delete();
        ShiftActivityLog::create([
            'shift_id' => $shiftId,
            'event_type' => 'post_removed',
            'metadata' => ['post_type' => $postType],
            'user_id' => $userId,
        ]);
        return response()->json(['ok' => true]);
    }

    /**
     * Submit an offer on someone else's post (trade: offer one or more of your shifts in preference order).
     * Body (trade): { offered_shift_ids: number[] } — ordered by preference; first is primary.
     * Body (cash/flight_follow): { offered_shift_id?: number }
     */
    public function offer(Request $request, SwapPost $post): JsonResponse
    {
        $user = $request->user();
        if ($post->user_id === $user->id) {
            return response()->json(['message' => 'You cannot offer on your own post.'], 403);
        }
        if ($post->status !== 'open') {
            return response()->json(['message' => 'Post is no longer open.'], 422);
        }
        $offeredShiftId = null;
        $offeredShiftPreferenceOrder = null;
        if (in_array($post->type, ['trade', 'time_trade'], true)) {
            $validator = Validator::make($request->all(), [
                'offered_shift_ids' => ['required', 'array'],
                'offered_shift_ids.*' => ['integer', 'exists:shifts,id'],
            ]);
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            $ids = array_values(array_map('intval', $request->input('offered_shift_ids')));
            if (count($ids) === 0) {
                return response()->json(['message' => 'At least one shift is required.'], 422);
            }
            $postShift = $post->shift ?? Shift::find($post->shift_id);
            $postStartDate = $postShift?->start_time_utc?->toDateString();
            foreach ($ids as $id) {
                $shift = Shift::find($id);
                if ($shift->user_id !== $user->id) {
                    return response()->json(['message' => 'You can only offer your own shifts.'], 403);
                }
                if ($post->type === 'time_trade' && $postStartDate && $shift->start_time_utc?->toDateString() !== $postStartDate) {
                    return response()->json(['message' => 'Time trade offers must be shifts on the same start date as the posted shift.'], 422);
                }
            }
            $offeredShiftId = $ids[0];
            $offeredShiftPreferenceOrder = $ids;
        } elseif (in_array($post->type, ['cash', 'flight_follow'], true)) {
            $validator = Validator::make($request->all(), [
                'offered_shift_id' => ['nullable', 'integer', 'exists:shifts,id'],
            ]);
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            if ($request->filled('offered_shift_id')) {
                $offeredShiftId = (int) $request->input('offered_shift_id');
                $offeredShift = Shift::find($offeredShiftId);
                if ($offeredShift->user_id !== $user->id) {
                    return response()->json(['message' => 'You can only offer your own shift.'], 403);
                }
            }
        } else {
            return response()->json(['message' => 'This post type does not accept offers.'], 422);
        }

        $existing = SwapOffer::where('swap_post_id', $post->id)
            ->where('offered_by_user_id', $user->id)
            ->whereIn('status', ['pending', 'selected'])
            ->first();
        if ($existing) {
            return response()->json(['message' => 'You already have a pending or accepted offer on this post.'], 422);
        }

        // Require primary contact: preferred_contact_method and phone when call/text
        $user->refresh();
        $preferred = $user->preferred_contact_method ?? null;
        if (! in_array($preferred, ['call', 'text', 'email'], true)) {
            return response()->json(['message' => 'Please set your preferred contact method in Profile settings (Settings → Profile) before responding to posts.'], 422);
        }
        if (in_array($preferred, ['call', 'text'], true) && empty(trim((string) $user->phone))) {
            return response()->json(['message' => 'Please add your phone number in Profile settings (Settings → Profile) before responding with Call or Text as your contact method.'], 422);
        }

        $responseNotes = $request->input('response_notes');
        $responseNotes = is_string($responseNotes) ? trim($responseNotes) : null;
        if ($responseNotes !== null && $responseNotes !== '') {
            $responseNotes = strlen($responseNotes) > 5000 ? substr($responseNotes, 0, 5000) : $responseNotes;
        } else {
            $responseNotes = null;
        }

        $offer = SwapOffer::create([
            'swap_post_id' => $post->id,
            'offered_by_user_id' => $user->id,
            'offered_shift_id' => $offeredShiftId,
            'offered_shift_preference_order' => $offeredShiftPreferenceOrder,
            'status' => 'pending',
            'response_notes' => $responseNotes,
        ]);

        $post->increment('click_count');

        AppNotification::create([
            'user_id' => $post->user_id,
            'type' => 'new_offer',
            'data' => [
                'swap_post_id' => $post->id,
                'swap_offer_id' => $offer->id,
                'message' => $user->name . ' responded to your ' . $this->postTypeLabel($post->type) . '. Respond from your dashboard.',
            ],
        ]);

        $message = in_array($post->type, ['trade', 'time_trade'], true)
            ? 'Offer submitted. The poster will be notified.'
            : 'Your response has been submitted. The poster will be notified.';

        return response()->json(['ok' => true, 'message' => $message]);
    }

    private function postTypeLabel(string $type): string
    {
        return match ($type) {
            'trade' => 'trade post',
            'time_trade' => 'time trade post',
            'cash' => 'giveaway post',
            'flight_follow' => 'flight follow post',
            default => 'post',
        };
    }
}
