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
use App\Services\BidTools\BidScenarioProfileBuilder;
use App\Services\BidTools\BidSimulationEngine;
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
            'participants' => $sim->participants->map(fn (BidSimulationParticipant $p) => [
                ...$this->participantPayload($p),
                'profile' => $p->scenario
                    ? $this->profileBuilder->toEditorPayload($p->scenario)
                    : $this->profileBuilder->defaultsForImport($sim->import),
            ]),
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
            'minimum_bid_lines' => max(1, (int) $p->seniority_rank),
            'bid_scenario_id' => $p->bid_scenario_id,
            'scenario_name' => $p->scenario?->name,
        ];
    }
}
