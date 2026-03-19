<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleReconciliationItem extends Model
{
    protected $fillable = [
        'schedule_reconciliation_id',
        'type',
        'shift_id',
        'snapshot',
        'user_action',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
        ];
    }

    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(ScheduleReconciliation::class, 'schedule_reconciliation_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }
}
