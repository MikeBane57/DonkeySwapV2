<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BidLine extends Model
{
    protected $fillable = [
        'bid_import_id',
        'line_num',
        'desk_group',
        'source_label',
        'start_time',
        'rotation',
        'workdays_from_file',
        'workdays_computed',
    ];

    protected function casts(): array
    {
        return [
            'workdays_from_file' => 'integer',
            'workdays_computed' => 'integer',
        ];
    }

    public function import(): BelongsTo
    {
        return $this->belongsTo(BidImport::class, 'bid_import_id');
    }

    public function days(): HasMany
    {
        return $this->hasMany(BidLineDay::class);
    }

    public function scenarioNotes(): HasMany
    {
        return $this->hasMany(BidScenarioLineNote::class);
    }
}
