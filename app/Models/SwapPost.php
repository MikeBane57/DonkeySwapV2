<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SwapPost extends Model
{
    protected static function booted(): void
    {
        static::updated(function (SwapPost $post) {
            UserHiddenPost::where('swap_post_id', $post->id)->delete();
        });
    }

    protected $fillable = [
        'shift_id',
        'user_id',
        'type',
        'cash_amount',
        'flight_follow_minutes',
        'flight_follow_at',
        'notes',
        'preferred_start_times',
        'preferred_desk_type',
        'status',
        'view_count',
        'click_count',
    ];

    protected function casts(): array
    {
        return [
            'cash_amount' => 'decimal:2',
            'preferred_start_times' => 'array',
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

    public function offers(): HasMany
    {
        return $this->hasMany(SwapOffer::class);
    }

    public function histories(): HasMany
    {
        return $this->hasMany(SwapPostHistory::class)->orderByDesc('changed_at');
    }
}
