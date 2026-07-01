<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BidScenario extends Model
{
    protected $fillable = [
        'user_id',
        'bid_import_id',
        'name',
        'vacation_bank',
        'weights',
        'holiday_rank',
        'desk_rank',
        'start_time_rank',
        'personal_dates',
        'code_overrides',
        'desk_bucket_mappings',
    ];

    protected function casts(): array
    {
        return [
            'vacation_bank' => 'integer',
            'weights' => 'array',
            'holiday_rank' => 'array',
            'desk_rank' => 'array',
            'start_time_rank' => 'array',
            'personal_dates' => 'array',
            'code_overrides' => 'array',
            'desk_bucket_mappings' => 'array',
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

    public function vacationRanges(): HasMany
    {
        return $this->hasMany(BidScenarioVacationRange::class);
    }

    public function lineNotes(): HasMany
    {
        return $this->hasMany(BidScenarioLineNote::class);
    }
}
