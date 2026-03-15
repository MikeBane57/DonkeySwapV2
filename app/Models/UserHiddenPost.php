<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserHiddenPost extends Model
{
    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'swap_post_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function swapPost(): BelongsTo
    {
        return $this->belongsTo(SwapPost::class);
    }
}
