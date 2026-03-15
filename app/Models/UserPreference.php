<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPreference extends Model
{
    protected $fillable = [
        'user_id',
        'preferred_shift_type',
        'shift_start_time_min',
        'shift_start_time_max',
        'willing_double_am_pm',
        'willing_double_pm_midnight',
        'willing_double_midnight_am',
        'double_gap_minutes_acceptable',
        'max_doubles_in_row',
        'hide_posts_that_would_be_double',
        'desired_desk_types',
    ];

    protected function casts(): array
    {
        return [
            'willing_double_am_pm' => 'boolean',
            'willing_double_pm_midnight' => 'boolean',
            'willing_double_midnight_am' => 'boolean',
            'hide_posts_that_would_be_double' => 'boolean',
            'desired_desk_types' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
