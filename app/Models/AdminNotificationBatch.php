<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AdminNotificationBatch extends Model
{
    protected $fillable = [
        'title',
        'body',
        'created_by',
        'active_at_start',
        'active_at_end',
    ];

    protected function casts(): array
    {
        return [
            'active_at_start' => 'datetime',
            'active_at_end' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(AppNotification::class, 'admin_notification_batch_id');
    }
}
