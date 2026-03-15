<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftSegment extends Model
{
    protected $fillable = ['shift_id', 'user_id', 'start_time_utc', 'end_time_utc'];

    protected function casts(): array
    {
        return [
            'start_time_utc' => 'datetime',
            'end_time_utc' => 'datetime',
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
}
