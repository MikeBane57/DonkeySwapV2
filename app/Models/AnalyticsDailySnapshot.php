<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnalyticsDailySnapshot extends Model
{
    protected $fillable = [
        'snapshot_date',
        'swap_posts_created',
        'swap_posts_resolved',
        'swap_resolve_seconds_sum',
        'swap_resolve_sample_count',
        'swap_offers_created',
        'lfw_posts_created',
        'lfw_posts_resolved',
        'lfw_resolve_seconds_sum',
        'lfw_resolve_sample_count',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'snapshot_date' => 'date',
            'computed_at' => 'datetime',
        ];
    }
}
