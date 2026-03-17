<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LookingForWorkPostHistory extends Model
{
    protected $table = 'looking_for_work_post_histories';

    protected $fillable = [
        'looking_for_work_post_id',
        'user_id',
        'changes',
        'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'changed_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(LookingForWorkPost::class, 'looking_for_work_post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
