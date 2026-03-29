<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidLineDay extends Model
{
    protected $fillable = [
        'bid_line_id',
        'assignment_date',
        'raw_cell',
        'is_off',
        'normalized_code',
    ];

    protected function casts(): array
    {
        return [
            'assignment_date' => 'date',
            'is_off' => 'boolean',
        ];
    }

    public function line(): BelongsTo
    {
        return $this->belongsTo(BidLine::class, 'bid_line_id');
    }
}
