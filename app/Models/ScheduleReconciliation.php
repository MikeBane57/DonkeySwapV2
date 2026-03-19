<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScheduleReconciliation extends Model
{
    protected $fillable = [
        'user_id',
        'bulk_apply_batch_id',
        'status',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(BulkApplyBatch::class, 'bulk_apply_batch_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ScheduleReconciliationItem::class, 'schedule_reconciliation_id');
    }
}
