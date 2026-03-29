<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidScenarioVacationRange extends Model
{
    protected $fillable = [
        'bid_scenario_id',
        'title',
        'starts_on',
        'ends_on',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function scenario(): BelongsTo
    {
        return $this->belongsTo(BidScenario::class, 'bid_scenario_id');
    }
}
