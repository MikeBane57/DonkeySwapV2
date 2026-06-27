<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BidSimulation extends Model
{
    protected $fillable = [
        'user_id',
        'bid_import_id',
        'name',
        'last_run_at',
        'last_run_results',
    ];

    protected function casts(): array
    {
        return [
            'last_run_at' => 'datetime',
            'last_run_results' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function import(): BelongsTo
    {
        return $this->belongsTo(BidImport::class, 'bid_import_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(BidSimulationParticipant::class)->orderBy('seniority_rank');
    }
}
