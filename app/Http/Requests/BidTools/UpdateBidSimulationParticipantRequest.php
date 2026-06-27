<?php

namespace App\Http\Requests\BidTools;

use App\Http\Requests\BidTools\Concerns\BidderProfileRules;
use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBidSimulationParticipantRequest extends FormRequest
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

        $participant = $this->route('participant');
        $participantId = $participant instanceof BidSimulationParticipant ? $participant->id : (int) $participant;

        return array_merge([
            'display_name' => ['required', 'string', 'max:120'],
            'seniority_rank' => [
                'required',
                'integer',
                'min:1',
                'max:500',
                Rule::unique('bid_simulation_participants', 'seniority_rank')
                    ->where('bid_simulation_id', $simulationId)
                    ->ignore($participantId),
            ],
        ], $this->bidderProfileRules());
    }
}
