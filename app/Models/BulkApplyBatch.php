<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BulkApplyBatch extends Model
{
    protected $table = 'bulk_apply_batches';

    protected $fillable = ['created_by'];

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reconciliations(): HasMany
    {
        return $this->hasMany(ScheduleReconciliation::class, 'bulk_apply_batch_id');
    }
}
