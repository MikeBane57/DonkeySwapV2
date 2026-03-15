<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkgroupAllowedStartTime extends Model
{
    protected $fillable = ['workgroup_id', 'start_time', 'default_duration_minutes'];

    protected function casts(): array
    {
        return [
            'start_time' => 'datetime:H:i',
        ];
    }

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class);
    }
}
