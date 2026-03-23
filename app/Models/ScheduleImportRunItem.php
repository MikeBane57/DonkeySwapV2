<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleImportRunItem extends Model
{
    protected $fillable = [
        'schedule_import_run_id',
        'user_id',
        'employee_id',
        'employee_name',
        'qualifications',
        'shift_date',
        'time_code',
        'desk_code',
        'start_time_utc',
        'end_time_utc',
        'duration_minutes',
        'matched_shift_id',
        'action',
        'reason',
        'warnings',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'qualifications' => 'array',
            'warnings' => 'array',
            'meta' => 'array',
            'shift_date' => 'date',
            'start_time_utc' => 'datetime',
            'end_time_utc' => 'datetime',
            'duration_minutes' => 'integer',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(ScheduleImportRun::class, 'schedule_import_run_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
