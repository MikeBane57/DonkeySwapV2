<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BuddyBidDayAssignment extends Model
{
    protected $fillable = [
        'buddy_bid_plan_id',
        'assignment_date',
        'double_participant_id',
    ];

    protected function casts(): array
    {
        return [
            'assignment_date' => 'date',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(BuddyBidPlan::class, 'buddy_bid_plan_id');
    }

    public function doubleParticipant(): BelongsTo
    {
        return $this->belongsTo(BuddyBidParticipant::class, 'double_participant_id');
    }
}
