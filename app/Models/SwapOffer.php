<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwapOffer extends Model
{
    protected $fillable = ['swap_post_id', 'offered_by_user_id', 'offered_shift_id', 'offered_shift_preference_order', 'status', 'response_notes', 'counter_cash_amount'];

    protected function casts(): array
    {
        return [
            'offered_shift_preference_order' => 'array',
            'counter_cash_amount' => 'decimal:2',
        ];
    }

    public function swapPost(): BelongsTo
    {
        return $this->belongsTo(SwapPost::class);
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
