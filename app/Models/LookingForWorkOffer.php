<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LookingForWorkOffer extends Model
{
    protected $table = 'looking_for_work_offers';

    protected $fillable = [
        'looking_for_work_post_id',
        'offered_by_user_id',
        'offered_shift_id',
        'offered_cash',
        'response_notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'offered_cash' => 'decimal:2',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(LookingForWorkPost::class, 'looking_for_work_post_id');
    }

    public function offeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'offered_by_user_id');
    }

    public function offeredShift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'offered_shift_id');
    }
}
