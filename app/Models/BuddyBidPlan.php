<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BuddyBidPlan extends Model
{
    protected $fillable = [
        'user_id',
        'bid_import_id',
        'name',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function import(): BelongsTo
    {
        return $this->belongsTo(BidImport::class, 'bid_import_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(BuddyBidParticipant::class)->orderBy('slot');
    }

    public function dayAssignments(): HasMany
    {
        return $this->hasMany(BuddyBidDayAssignment::class);
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(BuddyBidPlanSnapshot::class)->orderByDesc('created_at');
    }
}
