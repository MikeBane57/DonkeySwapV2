<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Shift extends Model
{
    protected $fillable = [
        'user_id',
        'workgroup_id',
        'position_name',
        'desk_type',
        'start_time_utc',
        'end_time_utc',
        'regulatory',
        'is_training',
    ];

    protected function casts(): array
    {
        return [
            'start_time_utc' => 'datetime',
            'end_time_utc' => 'datetime',
            'regulatory' => 'boolean',
            'is_training' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class);
    }

    public function segments(): HasMany
    {
        return $this->hasMany(ShiftSegment::class);
    }

    public function swapPost(): HasOne
    {
        return $this->hasOne(SwapPost::class);
    }

    public function swapPosts(): HasMany
    {
        return $this->hasMany(SwapPost::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ShiftActivityLog::class)->orderByDesc('created_at');
    }
}
