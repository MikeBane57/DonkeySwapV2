<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnalyticsShiftHistogramSnapshot extends Model
{
    protected $fillable = [
        'as_of_date',
        'shift_date',
        'swap_post_count',
    ];

    protected function casts(): array
    {
        return [
            'as_of_date' => 'date',
            'shift_date' => 'date',
        ];
    }
}
