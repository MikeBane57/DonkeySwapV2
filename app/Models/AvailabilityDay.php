<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AvailabilityDay extends Model
{
    protected $fillable = ['user_id', 'date', 'available'];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'available' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
