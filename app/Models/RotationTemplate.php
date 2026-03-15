<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RotationTemplate extends Model
{
    protected $fillable = ['name', 'pattern_json'];

    protected function casts(): array
    {
        return [
            'pattern_json' => 'array',
        ];
    }
}
