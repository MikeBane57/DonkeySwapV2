<?php

namespace Database\Seeders;

use App\Models\Workgroup;
use Illuminate\Database\Seeder;

class WorkgroupSeeder extends Seeder
{
    public function run(): void
    {
        $workgroups = [
            [
                'name' => 'Dispatch',
                'regulatory' => true,
                'max_hours_per_day' => 10,
                'rest_required_hours' => 8,
                'allow_double' => false,
            ],
            [
                'name' => 'Ramp',
                'regulatory' => false,
                'max_hours_per_day' => 10,
                'rest_required_hours' => 8,
                'allow_double' => true,
            ],
        ];

        foreach ($workgroups as $attrs) {
            Workgroup::updateOrCreate(
                ['name' => $attrs['name']],
                $attrs
            );
        }
    }
}
