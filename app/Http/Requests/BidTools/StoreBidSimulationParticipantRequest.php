<?php

namespace App\Http\Requests\BidTools;

use App\Models\BidSimulation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBidSimulationParticipantRequest extends FormRequest
{
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

        return [
            'display_name' => ['required', 'string', 'max:120'],
            'seniority_rank' => [
                'required',
                'integer',
                'min:1',
                'max:500',
                Rule::unique('bid_simulation_participants', 'seniority_rank')
                    ->where('bid_simulation_id', $simulationId),
            ],
            'bid_scenario_id' => [
                'required',
                'integer',
                Rule::exists('bid_scenarios', 'id')->where(fn ($q) => $q->where('user_id', $this->user()->id)),
            ],
        ];
    }
}
