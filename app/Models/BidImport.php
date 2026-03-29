<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BidImport extends Model
{
    protected $fillable = [
        'uploaded_by_user_id',
        'bid_year',
        'file_hash',
        'original_filename',
        'title',
        'is_current',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'bid_year' => 'integer',
            'is_current' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(BidLine::class);
    }

    public function scenarios(): HasMany
    {
        return $this->hasMany(BidScenario::class);
    }
}
