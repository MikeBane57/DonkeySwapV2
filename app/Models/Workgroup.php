<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workgroup extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'max_hours_per_day',
        'rest_required_hours',
        'allow_double',
    ];

    protected function casts(): array
    {
        return [
            'allow_double' => 'boolean',
        ];
    }

    /** Whether this workgroup has any desk type marked regulatory (used for compliance/DSP). */
    public function hasRegulatoryDeskTypes(): bool
    {
        return $this->deskTypes()->where('is_regulatory', true)->exists();
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_workgroups')
            ->withPivot('classification_seniority_date', 'red_line_seniority_number')
            ->withTimestamps();
    }

    public function allowedStartTimes(): HasMany
    {
        return $this->hasMany(WorkgroupAllowedStartTime::class);
    }

    public function positions(): HasMany
    {
        return $this->hasMany(WorkgroupPosition::class)->orderBy('sort_order')->orderBy('label');
    }

    public function deskTypes(): HasMany
    {
        return $this->hasMany(WorkgroupDeskType::class)->orderBy('sort_order')->orderBy('code');
    }

    public function positionRanges(): HasMany
    {
        return $this->hasMany(WorkgroupPositionRange::class)->orderBy('sort_order')->orderBy('range_spec');
    }

    public function qualifications(): HasMany
    {
        return $this->hasMany(WorkgroupQualification::class)->orderBy('sort_order')->orderBy('code');
    }

    public function redLines(): HasMany
    {
        return $this->hasMany(ClassificationRedLine::class, 'workgroup_id');
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }
}
