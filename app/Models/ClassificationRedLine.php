<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassificationRedLine extends Model
{
    protected $fillable = ['workgroup_id', 'red_line_position'];

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class);
    }
}
