<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\StoreBuddyBidPlanRequest;
use App\Http\Requests\BidTools\UpdateBuddyBidAssignmentsRequest;
use App\Http\Requests\BidTools\UpdateBuddyBidParticipantsRequest;
use App\Http\Requests\BidTools\UpdateBuddyBidPlanRequest;
use App\Models\BidImport;
use App\Models\BuddyBidDayAssignment;
use App\Models\BuddyBidParticipant;
use App\Models\BuddyBidPlan;
use App\Services\BidTools\BidLinePickerService;
use App\Services\BidTools\BuddyBidCalendarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BuddyBidController extends Controller
{
    public function __construct(
        private readonly BuddyBidCalendarService $calendar,
        private readonly BidLinePickerService $linePicker,
    ) {}

    public function index(Request $request): Response
    {
        $plans = BuddyBidPlan::query()
            ->where('user_id', $request->user()->id)
            ->with('import:id,bid_year,title')
            ->withCount('participants')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (BuddyBidPlan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'bid_year' => $plan->import->bid_year,
                'participants_count' => $plan->participants_count,
                'updated_at' => $plan->updated_at->toIso8601String(),
            ]);

        return Inertia::render('app/bid-tools/buddy-bids/index', [
            'plans' => $plans,
        ]);
    }

    public function create(): Response
    {
        $imports = BidImport::query()
            ->where('is_current', true)
            ->orderByDesc('bid_year')
            ->get(['id', 'bid_year', 'title', 'original_filename']);

        return Inertia::render('app/bid-tools/buddy-bids/create', [
            'imports' => $imports,
        ]);
    }

    public function store(StoreBuddyBidPlanRequest $request): RedirectResponse
    {
        $plan = BuddyBidPlan::create([
            'user_id' => $request->user()->id,
            'bid_import_id' => $request->validated('bid_import_id'),
            'name' => $request->validated('name'),
        ]);

        foreach ([
            ['slot' => 1, 'display_name' => 'User A'],
            ['slot' => 2, 'display_name' => 'User B'],
        ] as $participant) {
            BuddyBidParticipant::create([
                'buddy_bid_plan_id' => $plan->id,
                'slot' => $participant['slot'],
                'display_name' => $participant['display_name'],
                'profile' => $this->calendar->defaultProfile(),
            ]);
        }

        return redirect()
            ->route('bid-tools.buddy-bids.show', $plan->id)
            ->with('success', 'Buddy bid plan created. Pick lines for both buddies.');
    }

    public function show(Request $request, int $buddyBid): Response
    {
        $plan = $this->findPlan($request, $buddyBid);
        $plan->load(['import', 'participants.line']);

        $calendar = $this->calendar->build($plan);

        return Inertia::render('app/bid-tools/buddy-bids/show', [
            'plan' => [
                'id' => $plan->id,
                'name' => $plan->name,
                'bid_year' => $plan->import->bid_year,
                'bid_import_id' => $plan->bid_import_id,
            ],
            'calendar' => $calendar,
            'lines' => $this->linePicker->rowsForImport($plan->bid_import_id),
        ]);
    }

    public function update(UpdateBuddyBidPlanRequest $request, int $buddyBid): RedirectResponse
    {
        $plan = $this->findPlan($request, $buddyBid);
        $plan->update(['name' => $request->validated('name')]);

        return redirect()
            ->route('bid-tools.buddy-bids.show', $plan->id)
            ->with('success', 'Plan renamed.');
    }

    public function updateParticipants(
        UpdateBuddyBidParticipantsRequest $request,
        int $buddyBid,
    ): RedirectResponse {
        $plan = $this->findPlan($request, $buddyBid);
        $validated = $request->validated('participants');

        foreach ($validated as $index => $row) {
            $slot = $index + 1;
            $participant = BuddyBidParticipant::query()
                ->where('buddy_bid_plan_id', $plan->id)
                ->where('slot', $slot)
                ->firstOrFail();

            $participant->update([
                'display_name' => $row['display_name'],
                'bid_line_id' => $row['bid_line_id'],
                'profile' => array_merge(
                    $this->calendar->defaultProfile(),
                    $row['profile'] ?? [],
                ),
            ]);
        }

        BuddyBidDayAssignment::query()
            ->where('buddy_bid_plan_id', $plan->id)
            ->delete();

        return redirect()
            ->route('bid-tools.buddy-bids.show', $plan->id)
            ->with('success', 'Buddies and lines updated.');
    }

    public function updateAssignments(
        UpdateBuddyBidAssignmentsRequest $request,
        int $buddyBid,
    ): RedirectResponse|JsonResponse {
        $plan = $this->findPlan($request, $buddyBid);
        $participantIds = $plan->participants()->pluck('id')->all();

        foreach ($request->validated('assignments') as $row) {
            $doubleId = $row['double_participant_id'] ?? null;
            if ($doubleId !== null && ! in_array($doubleId, $participantIds, true)) {
                continue;
            }

            if ($doubleId === null) {
                BuddyBidDayAssignment::query()
                    ->where('buddy_bid_plan_id', $plan->id)
                    ->whereDate('assignment_date', $row['date'])
                    ->delete();

                continue;
            }

            BuddyBidDayAssignment::query()->updateOrCreate(
                [
                    'buddy_bid_plan_id' => $plan->id,
                    'assignment_date' => $row['date'],
                ],
                [
                    'double_participant_id' => $doubleId,
                ],
            );
        }

        if ($request->wantsJson()) {
            return response()->json(['saved' => true]);
        }

        return redirect()
            ->route('bid-tools.buddy-bids.show', $plan->id)
            ->with('success', 'Overlap assignments saved.');
    }

    public function destroy(Request $request, int $buddyBid): RedirectResponse
    {
        $plan = $this->findPlan($request, $buddyBid);
        $plan->delete();

        return redirect()
            ->route('bid-tools.buddy-bids.index')
            ->with('success', 'Buddy bid plan deleted.');
    }

    private function findPlan(Request $request, int $id): BuddyBidPlan
    {
        return BuddyBidPlan::query()
            ->where('user_id', $request->user()->id)
            ->whereKey($id)
            ->firstOrFail();
    }
}
