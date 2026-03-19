<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LookingForWorkPost extends Model
{
    protected $fillable = [
        'user_id',
        'seeking_date',
        'seeking_desk_types',
        'seeking_cash',
        'seeking_obo',
        'status',
        'notes',
        'willing_to_follow',
        'willing_to_follow_time_frame',
        'willing_to_follow_slots',
        'willing_to_follow_custom',
        'view_count',
        'click_count',
    ];

    protected function casts(): array
    {
        return [
            'seeking_date' => 'date',
            'seeking_desk_types' => 'array',
            'seeking_cash' => 'decimal:2',
            'seeking_obo' => 'boolean',
            'willing_to_follow' => 'boolean',
            'willing_to_follow_slots' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function offers(): HasMany
    {
        return $this->hasMany(LookingForWorkOffer::class, 'looking_for_work_post_id');
    }

    public function pendingOffers(): HasMany
    {
        return $this->offers()->where('status', 'pending');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(LookingForWorkPostHistory::class, 'looking_for_work_post_id')->orderByDesc('changed_at');
    }
}
