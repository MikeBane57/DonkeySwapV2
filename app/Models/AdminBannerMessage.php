<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AdminBannerMessage extends Model
{
    protected $fillable = [
        'title',
        'body',
        'target_type',
        'target_workgroup_id',
        'created_by',
        'active_at_start',
        'active_at_end',
    ];

    protected function casts(): array
    {
        return [
            'active_at_start' => 'datetime',
            'active_at_end' => 'datetime',
        ];
    }

    public function workgroup(): BelongsTo
    {
        return $this->belongsTo(Workgroup::class, 'target_workgroup_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function recipients(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'admin_banner_recipients', 'admin_banner_message_id', 'user_id');
    }

    public function acknowledgements(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'admin_banner_acknowledgements', 'admin_banner_message_id', 'user_id')
            ->withPivot('acknowledged_at');
    }
}
