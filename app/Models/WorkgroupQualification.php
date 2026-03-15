<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class WorkgroupQualification extends Model
{
    protected $fillable = [
        'workgroup_id',
        'code',
        'label',
        'sort_order',
    ];

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_workgroup_qualifications')
            ->withTimestamps();
    }
}
