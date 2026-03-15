<?php

namespace Database\Seeders;

use App\Models\Workgroup;
use App\Models\WorkgroupAllowedStartTime;
use Illuminate\Database\Seeder;

class WorkgroupAllowedStartTimeSeeder extends Seeder
{
    /**
     * Allowed start times in Central (stored as time of day).
     * 06:00 = 6 AM, 14:00 = 2 PM, 22:00 = 10 PM. Default duration 510 min = 8h 30m.
     */
    public function run(): void
    {
        $config = [
            'Dispatch' => [
                ['start' => '06:00', 'duration_minutes' => 510],
                ['start' => '14:00', 'duration_minutes' => 510],
                ['start' => '22:00', 'duration_minutes' => 510],
            ],
            'Ramp' => [
                ['start' => '05:00', 'duration_minutes' => 480],
                ['start' => '13:00', 'duration_minutes' => 480],
                ['start' => '21:00', 'duration_minutes' => 480],
            ],
        ];

        foreach ($config as $workgroupName => $times) {
            $workgroup = Workgroup::where('name', $workgroupName)->first();
            if (! $workgroup) {
                continue;
            }

            foreach ($times as $t) {
                WorkgroupAllowedStartTime::updateOrCreate(
                    [
                        'workgroup_id' => $workgroup->id,
                        'start_time' => $t['start'].':00',
                    ],
                    ['default_duration_minutes' => $t['duration_minutes']]
                );
            }
        }
    }
}
