<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkgroupPosition extends Model
{
    protected $fillable = [
        'workgroup_id',
        'label',
        'type',
        'sublocation_type',
        'sort_order',
    ];

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class);
    }
}
