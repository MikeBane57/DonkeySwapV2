<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftActivityLog extends Model
{
    const UPDATED_AT = null;

    protected $fillable = [
        'shift_id',
        'event_type',
        'metadata',
        'user_id',
        'swap_post_id',
        'swap_offer_id',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function swapPost(): BelongsTo
    {
        return $this->belongsTo(SwapPost::class);
    }

    public function swapOffer(): BelongsTo
    {
        return $this->belongsTo(SwapOffer::class);
    }
}
