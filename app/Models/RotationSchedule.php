<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class RotationSchedule extends Model
{
    protected $fillable = [
        'name',
        'start_date',
        'end_date',
        'position_name',
        'pattern_type',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    /**
     * Pattern 5-3-5-5: 5 working, 3 off, 5 working, 5 off (18-day cycle).
     * Day 0 = first day of schedule = working.
     */
    public function getWorkingDaysAttribute(): array
    {
        $start = $this->start_date->copy();
        $end = $this->end_date->copy();
        $working = [];
        $current = $start->copy();
        while ($current->lte($end)) {
            $dayIndex = (int) $start->diffInDays($current);
            $positionInCycle = $dayIndex % 18;
            $isWorking = $positionInCycle < 5 || ($positionInCycle >= 8 && $positionInCycle < 13);
            if ($isWorking) {
                $working[] = $current->format('Y-m-d');
            }
            $current->addDay();
        }
        return $working;
    }
}
