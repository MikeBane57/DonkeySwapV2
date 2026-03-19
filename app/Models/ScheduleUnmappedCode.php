<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleUnmappedCode extends Model
{
    protected $table = 'schedule_unmapped_codes';

    protected $fillable = [
        'source',
        'code_type',
        'code',
        'seen_count',
        'first_seen_at',
        'last_seen_at',
        'examples',
    ];

    protected function casts(): array
    {
        return [
            'seen_count' => 'integer',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'examples' => 'array',
        ];
    }
}
