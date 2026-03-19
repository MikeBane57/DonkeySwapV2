<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScheduleImportRun extends Model
{
    protected $fillable = [
        'created_by_user_id',
        'target_user_id',
        'bulk_apply_batch_id',
        'mode',
        'source',
        'timezone',
        'status',
        'row_count',
        'created_count',
        'updated_count',
        'skipped_count',
        'conflict_count',
        'missing_count',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'row_count' => 'integer',
            'created_count' => 'integer',
            'updated_count' => 'integer',
            'skipped_count' => 'integer',
            'conflict_count' => 'integer',
            'missing_count' => 'integer',
            'meta' => 'array',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function bulkApplyBatch(): BelongsTo
    {
        return $this->belongsTo(BulkApplyBatch::class, 'bulk_apply_batch_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ScheduleImportRunItem::class);
    }
}

