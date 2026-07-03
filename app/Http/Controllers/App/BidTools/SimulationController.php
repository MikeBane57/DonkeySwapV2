<?php

namespace App\Http\Controllers\App\BidTools;

use App\Http\Controllers\Controller;
use App\Http\Requests\BidTools\StoreBidSimulationParticipantRequest;
use App\Http\Requests\BidTools\StoreBidSimulationRequest;
use App\Http\Requests\BidTools\UpdateBidSimulationParticipantRequest;
use App\Http\Requests\BidTools\UpdateBidSimulationRequest;
use App\Models\BidImport;
use App\Models\BidScenario;
use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;
use App\Services\BidTools\BidLinePickerService;
use App\Services\BidTools\BidScenarioProfileBuilder;
use App\Services\BidTools\BidSimulationEngine;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SimulationController extends Controller
{
    public function __construct(
        private readonly BidSimulationEngine $engine,
        private readonly BidScenarioProfileBuilder $profileBuilder,
        private readonly BidLinePickerService $linePicker,
        private readonly ScenarioScoreService $scoreService,
    ) {}

    public function index(Request $request): Response
    {
        $simulations = BidSimulation::query()
            ->where('user_id', $request->user()->id)
            ->with('import:id,bid_year,title')
            ->withCount('participants')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (BidSimulation $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'bid_year' => $s->import->bid_year,
                'participants_count' => $s->participants_count,
                'last_run_at' => $s->last_run_at?->toIso8601String(),
                'updated_at' => $s->updated_at->toIso8601String(),
            ]);

        return Inertia::render('app/bid-tools/simulations/index', [
            'simulations' => $simulations,
        ]);
    }

    public function create(): Response
    {
        $imports = BidImport::query()
            ->where('is_current', true)
            ->orderByDesc('bid_year')
            ->get(['id', 'bid_year', 'title', 'original_filename']);

        return Inertia::render('app/bid-tools/simulations/create', [
            'imports' => $imports,
        ]);
    }

    public function store(StoreBidSimulationRequest $request): RedirectResponse
    {
        $simulation = BidSimulation::create([
            'user_id' => $request->user()->id,
            'bid_import_id' => $request->validated('bid_import_id'),
            'name' => $request->validated('name'),
        ]);

        return redirect()
            ->route('bid-tools.simulations.edit', $simulation->id)
            ->with('success', 'Simulation created. Add bidders below.');
    }

    public function show(Request $request, int $simulation): Response
    {
        $sim = $this->findSimulation($request, $simulation);
        $sim->load(['import', 'participants.scenario']);

        return Inertia::render('app/bid-tools/simulations/show', [
            'simulation' => $this->simulationPayload($sim),
            'participants' => $sim->participants->map(fn (BidSimulationParticipant $p) => $this->participantPayload($p)),
            'results' => $sim->last_run_results,
        ]);
    }

    public function edit(Request $request, int $simulation): Response
    {
        $sim = $this->findSimulation($request, $simulation);
        $sim->load(['import', 'participants.scenario']);

        return Inertia::render('app/bid-tools/simulations/edit', [
            'simulation' => $this->simulationPayload($sim),
            'profile_defaults' => $this->profileBuilder->defaultsForImport($sim->import),
            'profile_templates' => $this->profileTemplatesForSimulation($request, $sim),
            'participants' => $sim->participants->map(fn (BidSimulationParticipant $p) => [
                ...$this->participantPayload($p),
                'profile' => $p->scenario
                    ? $this->profileBuilder->toEditorPayload($p->scenario)
                    : $this->profileBuilder->defaultsForImport($sim->import),
            ]),
            'lines' => $this->linePicker->rowsForImport($sim->bid_import_id),
        ]);
    }

    public function update(UpdateBidSimulationRequest $request, int $simulation): RedirectResponse
    {
        $sim = $this->findSimulation($request, $simulation);
        $sim->update(['name' => $request->validated('name')]);

        return redirect()
            ->route('bid-tools.simulations.edit', $sim->id)
            ->with('success', 'Simulation updated.');
    }

    public function destroy(Request $request, int $simulation): RedirectResponse
    {
        $sim = $this->findSimulation($request, $simulation);

        DB::transaction(function () use ($sim) {
            $scenarioIds = $sim->participants()->pluck('bid_scenario_id')->unique()->all();
            $sim->delete();

            foreach ($scenarioIds as $scenarioId) {
                $stillUsed = BidSimulationParticipant::query()
                    ->where('bid_scenario_id', $scenarioId)
                    ->exists();

                if (! $stillUsed) {
                    BidScenario::query()->whereKey($scenarioId)->delete();
                }
            }
        });

        return redirect()
            ->route('bid-tools.simulations.index')
            ->with('success', 'Simulation deleted.');
    }

    public function duplicate(Request $request, int $simulation): RedirectResponse
    {
        $source = $this->findSimulation($request, $simulation);
        $source->load(['participants.scenario.vacationRanges']);

        $copy = DB::transaction(function () use ($request, $source) {
            $simulation = BidSimulation::create([
                'user_id' => $request->user()->id,
                'bid_import_id' => $source->bid_import_id,
                'name' => $this->duplicateSimulationName($request->user()->id, $source->name),
            ]);

            foreach ($source->participants->sortBy('seniority_rank') as $participant) {
                $scenario = $participant->scenario;
                if ($scenario === null) {
                    continue;
                }

                $scenario->loadMissing('vacationRanges');
                $legacyRanges = $scenario->vacationRanges->map(fn ($r) => [
                    'title' => $r->title ?? '',
                    'starts_on' => $r->starts_on->format('Y-m-d'),
                    'ends_on' => $r->ends_on->format('Y-m-d'),
                ])->all();

                $newScenario = BidScenario::create([
                    'user_id' => $request->user()->id,
                    'bid_import_id' => $scenario->bid_import_id,
                    'name' => "{$participant->display_name} · {$simulation->name}",
                    'vacation_bank' => $scenario->vacation_bank,
                    'weights' => $scenario->weights,
                    'holiday_rank' => $scenario->holiday_rank,
                    'desk_rank' => $scenario->desk_rank,
                    'start_time_rank' => $scenario->start_time_rank ?? [],
                    'personal_dates' => $this->scoreService->personalDatesForEditor(
                        $scenario->personal_dates ?? [],
                        $legacyRanges,
                    ),
                    'code_overrides' => $scenario->code_overrides ?? [],
                    'desk_bucket_mappings' => $scenario->desk_bucket_mappings ?? [],
                    'line_desk_buckets' => $scenario->line_desk_buckets ?? [],
                ]);

                BidSimulationParticipant::create([
                    'bid_simulation_id' => $simulation->id,
                    'display_name' => $participant->display_name,
                    'seniority_rank' => $participant->seniority_rank,
                    'skips_bid' => $participant->skips_bid,
                    'bid_scenario_id' => $newScenario->id,
                ]);
            }

            return $simulation;
        });

        return redirect()
            ->route('bid-tools.simulations.edit', $copy->id)
            ->with('success', 'Simulation duplicated. Adjust the copy as needed.');
    }

    public function storeParticipant(
        StoreBidSimulationParticipantRequest $request,
        int $simulation,
    ): RedirectResponse {
        $sim = $this->findSimulation($request, $simulation);
        $sim->loadMissing('import');

        DB::transaction(function () use ($request, $sim) {
            $displayName = $request->validated('display_name');
            $scenarioName = "{$displayName} · {$sim->name}";

            $scenario = $this->profileBuilder->createForSimulation(
                $request->user()->id,
                $sim->import,
                $scenarioName,
                $request->validated('profile'),
            );

            BidSimulationParticipant::create([
                'bid_simulation_id' => $sim->id,
                'display_name' => $displayName,
                'seniority_rank' => (int) $request->validated('seniority_rank'),
                'skips_bid' => (bool) $request->validated('skips_bid'),
                'bid_scenario_id' => $scenario->id,
            ]);

            $sim->update(['last_run_at' => null, 'last_run_results' => null]);
        });

        return redirect()
            ->route('bid-tools.simulations.edit', $sim->id)
            ->with('success', 'Bidder added.');
    }

    public function updateParticipant(
        UpdateBidSimulationParticipantRequest $request,
        int $simulation,
        int $participant,
    ): RedirectResponse {
        $sim = $this->findSimulation($request, $simulation);
        $p = $this->findParticipant($sim, $participant);
        $p->load('scenario');

        DB::transaction(function () use ($request, $sim, $p) {
            $displayName = $request->validated('display_name');

            $p->update([
                'display_name' => $displayName,
                'seniority_rank' => (int) $request->validated('seniority_rank'),
                'skips_bid' => (bool) $request->validated('skips_bid'),
            ]);

            if ($p->scenario) {
                $p->scenario->update([
                    'name' => "{$displayName} · {$sim->name}",
                ]);
                $this->profileBuilder->applyToScenario(
                    $p->scenario,
                    $request->validated('profile'),
                );
            }

            $sim->update(['last_run_at' => null, 'last_run_results' => null]);
        });

        return redirect()
            ->route('bid-tools.simulations.edit', $sim->id)
            ->with('success', 'Bidder updated.');
    }

    public function destroyParticipant(Request $request, int $simulation, int $participant): RedirectResponse
    {
        $sim = $this->findSimulation($request, $simulation);
        $p = $this->findParticipant($sim, $participant);
        $scenarioId = $p->bid_scenario_id;

        DB::transaction(function () use ($sim, $p, $scenarioId) {
            $p->delete();

            $stillUsed = BidSimulationParticipant::query()
                ->where('bid_scenario_id', $scenarioId)
                ->exists();

            if (! $stillUsed) {
                BidScenario::query()->whereKey($scenarioId)->delete();
            }

            $sim->update(['last_run_at' => null, 'last_run_results' => null]);
        });

        return redirect()
            ->route('bid-tools.simulations.edit', $sim->id)
            ->with('success', 'Bidder removed.');
    }

    public function run(Request $request, int $simulation): RedirectResponse
    {
        $sim = $this->findSimulation($request, $simulation);
        $sim->load('participants.scenario');

        if ($sim->participants->isEmpty()) {
            return redirect()
                ->route('bid-tools.simulations.show', $sim->id)
                ->with('error', 'Add at least one bidder before running the simulation.');
        }

        $results = $this->engine->run($sim);
        $sim->update([
            'last_run_at' => now(),
            'last_run_results' => $results,
        ]);

        return redirect()
            ->route('bid-tools.simulations.show', $sim->id)
            ->with('success', 'Simulation complete.');
    }

    public function recommendations(Request $request, int $simulation, int $participant): Response
    {
        $sim = $this->findSimulation($request, $simulation);
        $p = $this->findParticipant($sim, $participant);
        $p->load('scenario');

        $rows = $this->engine->recommendForParticipant($p);
        $minimumDepth = max(1, (int) $p->seniority_rank);

        return Inertia::render('app/bid-tools/simulations/recommendations', [
            'simulation' => $this->simulationPayload($sim),
            'participant' => $this->participantPayload($p),
            'minimum_depth' => $minimumDepth,
            'rows' => $rows,
        ]);
    }

    private function findSimulation(Request $request, int $id): BidSimulation
    {
        return BidSimulation::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);
    }

    private function findParticipant(BidSimulation $simulation, int $participantId): BidSimulationParticipant
    {
        return BidSimulationParticipant::query()
            ->where('bid_simulation_id', $simulation->id)
            ->findOrFail($participantId);
    }

    /**
     * @return array<string, mixed>
     */
    private function simulationPayload(BidSimulation $sim): array
    {
        $sim->loadMissing('import');

        return [
            'id' => $sim->id,
            'name' => $sim->name,
            'bid_import_id' => $sim->bid_import_id,
            'bid_year' => $sim->import->bid_year,
            'import_title' => $sim->import->title,
            'last_run_at' => $sim->last_run_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function participantPayload(BidSimulationParticipant $p): array
    {
        $p->loadMissing('scenario');

        return [
            'id' => $p->id,
            'display_name' => $p->display_name,
            'seniority_rank' => $p->seniority_rank,
            'skips_bid' => (bool) $p->skips_bid,
            'minimum_bid_lines' => max(1, (int) $p->seniority_rank),
            'bid_scenario_id' => $p->bid_scenario_id,
            'scenario_name' => $p->scenario?->name,
        ];
    }

    private function duplicateSimulationName(int $userId, string $name): string
    {
        $base = preg_replace('/ \(\d+\)$/', '', trim($name)) ?: 'Simulation';
        $candidate = $base.' (copy)';
        $suffix = 2;

        while (BidSimulation::query()
            ->where('user_id', $userId)
            ->where('name', $candidate)
            ->exists()) {
            $candidate = $base.' (copy '.$suffix.')';
            $suffix++;
        }

        return $candidate;
    }

    /**
     * @return list<array{id: int, name: string, profile: array<string, mixed>}>
     */
    private function profileTemplatesForSimulation(Request $request, BidSimulation $sim): array
    {
        return BidScenario::query()
            ->where('user_id', $request->user()->id)
            ->where('bid_import_id', $sim->bid_import_id)
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(fn (BidScenario $scenario) => [
                'id' => $scenario->id,
                'name' => $scenario->name,
                'profile' => $this->profileBuilder->toEditorPayload($scenario),
            ])
            ->values()
            ->all();
    }
}
