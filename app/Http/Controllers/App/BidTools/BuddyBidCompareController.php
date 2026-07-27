<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\CompareBuddyBidSnapshotsRequest;
use App\Models\BuddyBidPlan;
use App\Models\BuddyBidPlanSnapshot;
use App\Services\BidTools\BuddyBidSnapshotService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BuddyBidCompareController extends Controller
{
    private const SESSION_PREFIX = 'buddy_bid_compare_';

    public function __construct(
        private readonly BuddyBidSnapshotService $snapshots,
    ) {}

    public function show(Request $request, int $buddyBid): Response
    {
        $plan = $this->findPlan($request, $buddyBid);
        $plan->load(['import', 'snapshots']);

        $stored = $request->session()->get($this->sessionKey($plan->id));
        $comparison = is_array($stored) ? $stored : null;

        $prefillSnapshotIds = $this->parseIds($request->query('snapshot_ids'));
        if ($prefillSnapshotIds === [] && is_array($comparison)) {
            $prefillSnapshotIds = collect($comparison['versions'] ?? [])
                ->filter(fn (array $version) => $version['id'] !== null)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        $prefillIncludeCurrent = $request->boolean('include_current');
        if (! $request->has('include_current') && is_array($comparison)) {
            $prefillIncludeCurrent = (bool) ($comparison['include_current'] ?? false);
        }

        return Inertia::render('app/bid-tools/buddy-bids/compare', [
            'plan' => [
                'id' => $plan->id,
                'name' => $plan->name,
                'bid_year' => $plan->import->bid_year,
            ],
            'snapshots' => $plan->snapshots->map(fn (BuddyBidPlanSnapshot $snapshot) => [
                'id' => $snapshot->id,
                'name' => $snapshot->name,
                'created_at' => $snapshot->created_at->toIso8601String(),
                'balance' => $snapshot->balance,
            ]),
            'comparison' => $comparison,
            'prefill' => [
                'snapshot_ids' => $prefillSnapshotIds,
                'include_current' => $prefillIncludeCurrent,
            ],
        ]);
    }

    public function compare(
        CompareBuddyBidSnapshotsRequest $request,
        int $buddyBid,
    ): RedirectResponse {
        $plan = $this->findPlan($request, $buddyBid);
        $snapshotIds = array_values(array_unique(array_map(
            'intval',
            $request->validated('snapshot_ids'),
        )));
        $includeCurrent = (bool) ($request->validated('include_current') ?? false);

        $versionCount = count($snapshotIds) + ($includeCurrent ? 1 : 0);
        if ($versionCount < 2) {
            return redirect()
                ->route('bid-tools.buddy-bids.compare.show', $plan->id)
                ->withErrors(['snapshot_ids' => 'Select at least two versions to compare.']);
        }

        $snapshots = BuddyBidPlanSnapshot::query()
            ->where('buddy_bid_plan_id', $plan->id)
            ->whereIn('id', $snapshotIds)
            ->orderBy('created_at')
            ->get();

        $versions = [];

        if ($includeCurrent) {
            $current = $this->snapshots->captureCurrentState($plan->load(['import', 'participants.line', 'dayAssignments']));
            $versions[] = [
                'key' => 'current',
                'id' => null,
                'name' => 'Current plan',
                'created_at' => null,
                'assignments' => $current['assignments'],
                'summary' => $current['summary'],
                'balance' => $current['balance'],
                'participants' => $current['participants'],
            ];
        }

        foreach ($snapshots as $snapshot) {
            $versions[] = [
                'key' => 'snapshot_'.$snapshot->id,
                'id' => $snapshot->id,
                'name' => $snapshot->name,
                'created_at' => $snapshot->created_at->toIso8601String(),
                'assignments' => $snapshot->assignments ?? [],
                'summary' => $snapshot->summary ?? [],
                'balance' => $snapshot->balance ?? [],
                'participants' => $snapshot->participants ?? [],
            ];
        }

        $payload = [
            'include_current' => $includeCurrent,
            'versions' => $versions,
            'pairwise_diffs' => $this->snapshots->pairwiseDiffs($versions),
        ];

        $request->session()->put($this->sessionKey($plan->id), $payload);

        return redirect()->route('bid-tools.buddy-bids.compare.show', $plan->id);
    }

    private function sessionKey(int $planId): string
    {
        return self::SESSION_PREFIX.$planId;
    }

    /**
     * @return list<int>
     */
    private function parseIds(mixed $value): array
    {
        if (is_string($value)) {
            $value = explode(',', $value);
        }

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_map('intval', $value)));
    }

    private function findPlan(Request $request, int $id): BuddyBidPlan
    {
        return BuddyBidPlan::query()
            ->where('user_id', $request->user()->id)
            ->whereKey($id)
            ->firstOrFail();
    }
}
