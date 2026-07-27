<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BuddyBidPlanSnapshot extends Model
{
    protected $fillable = [
        'buddy_bid_plan_id',
        'name',
        'assignments',
        'summary',
        'balance',
        'participants',
    ];

    protected function casts(): array
    {
        return [
            'assignments' => 'array',
            'summary' => 'array',
            'balance' => 'array',
            'participants' => 'array',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(BuddyBidPlan::class, 'buddy_bid_plan_id');
    }
}
