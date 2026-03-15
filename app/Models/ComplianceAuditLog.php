<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComplianceAuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'action_type',
        'shift_ids',
        'rule_violated',
        'message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'shift_ids' => 'array',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
