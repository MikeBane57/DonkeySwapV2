<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwapPostHistory extends Model
{
    const UPDATED_AT = null;

    protected $fillable = ['swap_post_id', 'user_id', 'changes', 'changed_at'];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'changed_at' => 'datetime',
        ];
    }

    public function swapPost(): BelongsTo
    {
        return $this->belongsTo(SwapPost::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
