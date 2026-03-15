<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkgroupDeskType extends Model
{
    protected $fillable = [
        'workgroup_id',
        'code',
        'label',
        'workgroup_qualification_id',
        'sort_order',
    ];

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class);
    }

    public function qualification(): BelongsTo
    {
        return $this->belongsTo(WorkgroupQualification::class, 'workgroup_qualification_id');
    }

    public function positionRanges(): HasMany
    {
        return $this->hasMany(WorkgroupPositionRange::class, 'workgroup_desk_type_id');
    }
}
