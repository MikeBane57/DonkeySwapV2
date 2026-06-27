<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidSimulationParticipant extends Model
{
    protected $fillable = [
        'bid_simulation_id',
        'seniority_rank',
        'display_name',
        'bid_scenario_id',
    ];

    protected function casts(): array
    {
        return [
            'seniority_rank' => 'integer',
        ];
    }

    public function simulation(): BelongsTo
    {
        return $this->belongsTo(BidSimulation::class, 'bid_simulation_id');
    }

    public function scenario(): BelongsTo
    {
        return $this->belongsTo(BidScenario::class, 'bid_scenario_id');
    }
}
