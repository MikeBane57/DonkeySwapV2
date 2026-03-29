<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidScenarioLineNote extends Model
{
    protected $fillable = [
        'bid_scenario_id',
        'bid_line_id',
        'submitted_externally',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'submitted_externally' => 'boolean',
        ];
    }

    public function scenario(): BelongsTo
    {
        return $this->belongsTo(BidScenario::class, 'bid_scenario_id');
    }

    public function line(): BelongsTo
    {
        return $this->belongsTo(BidLine::class, 'bid_line_id');
    }
}
