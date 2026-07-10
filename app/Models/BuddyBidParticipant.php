<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BuddyBidParticipant extends Model
{
    protected $fillable = [
        'buddy_bid_plan_id',
        'slot',
        'display_name',
        'bid_line_id',
        'profile',
    ];

    protected function casts(): array
    {
        return [
            'slot' => 'integer',
            'profile' => 'array',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(BuddyBidPlan::class, 'buddy_bid_plan_id');
    }

    public function line(): BelongsTo
    {
        return $this->belongsTo(BidLine::class, 'bid_line_id');
    }

    /**
     * @return list<string>
     */
    public function vacationDates(): array
    {
        return array_values($this->profile['vacation_dates'] ?? []);
    }

    /**
     * @return list<string>
     */
    public function pullDates(): array
    {
        return array_values($this->profile['pull_dates'] ?? []);
    }
}
