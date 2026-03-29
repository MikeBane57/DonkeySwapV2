<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComplianceAuditLog extends Model
{
    /** MySQL TEXT max ~64KB; keep headroom below UTF-8 expansion. */
    public const RULE_VIOLATED_MAX_BYTES = 60000;

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

    /**
     * @param  array<int, string>  $errors
     */
    public static function summarizeRuleViolated(array $errors): string
    {
        if ($errors === []) {
            return '';
        }
        $s = implode('; ', $errors);
        if (strlen($s) > self::RULE_VIOLATED_MAX_BYTES) {
            return substr($s, 0, self::RULE_VIOLATED_MAX_BYTES).'… [truncated; see metadata.errors]';
        }

        return $s;
    }
}
