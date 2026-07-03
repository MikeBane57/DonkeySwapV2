<?php

namespace App\Http\Requests\BidTools;

use App\Http\Requests\BidTools\Concerns\BidderProfileRules;
use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;
use Illuminate\Foundation\Http\FormRequest;

class StoreBidSimulationParticipantRequest extends FormRequest
{
    use BidderProfileRules;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $simulation = $this->route('simulation');
        $simulationId = $simulation instanceof BidSimulation ? $simulation->id : (int) $simulation;
        $existingCount = BidSimulationParticipant::query()
            ->where('bid_simulation_id', $simulationId)
            ->count();

        return array_merge([
            'display_name' => ['required', 'string', 'max:120'],
            'seniority_rank' => [
                'required',
                'integer',
                'min:1',
                'max:'.max(1, $existingCount + 1),
            ],
            'skips_bid' => ['sometimes', 'boolean'],
        ], $this->bidderProfileRules());
    }
}
