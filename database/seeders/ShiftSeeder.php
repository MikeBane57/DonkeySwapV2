<?php

namespace Database\Seeders;

use App\Models\Shift;
use App\Models\User;
use App\Models\Workgroup;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class ShiftSeeder extends Seeder
{
    private const CENTRAL_TZ = 'America/Chicago';

    /**
     * Create 14 days of demo shifts for at least 3 users.
     * Shifts are defined in Central time then stored as UTC.
     */
    public function run(): void
    {
        $dispatch = Workgroup::where('name', 'Dispatch')->first();
        if (! $dispatch) {
            return;
        }

        $users = User::whereIn('email', [
            'mike@example.com',
            'jordan@example.com',
            'sam@example.com',
            'riley@example.com',
        ])->orderByRaw("CASE email WHEN 'mike@example.com' THEN 0 WHEN 'jordan@example.com' THEN 1 WHEN 'sam@example.com' THEN 2 ELSE 3 END")
            ->get();

        if ($users->isEmpty()) {
            return;
        }

        $users = $users->values();
        $startDate = Carbon::today(self::CENTRAL_TZ)->startOfDay();
        $endDate = $startDate->copy()->addDays(14);
        $positions = ['AM Dispatch', 'PM Dispatch', 'Midnight Dispatch'];

        $userIds = $users->pluck('id')->toArray();
        Shift::whereIn('user_id', $userIds)
            ->where('workgroup_id', $dispatch->id)
            ->where('start_time_utc', '>=', $startDate->copy()->utc())
            ->where('start_time_utc', '<', $endDate->copy()->utc())
            ->delete();

        for ($day = 0; $day < 14; $day++) {
            $date = $startDate->copy()->addDays($day);

            $shiftsCentral = [
                ['start' => '06:00', 'end' => '14:00', 'position' => $positions[0]],
                ['start' => '14:00', 'end' => '22:00', 'position' => $positions[1]],
                ['start' => '22:00', 'end' => '06:00', 'position' => $positions[2], 'next_day_end' => true],
            ];

            foreach ($shiftsCentral as $i => $s) {
                $userIndex = ($day + $i) % $users->count();
                $user = $users[$userIndex] ?? $users[0];
                $startCentral = Carbon::parse($date->format('Y-m-d').' '.$s['start'], self::CENTRAL_TZ);
                if (! empty($s['next_day_end'])) {
                    $endCentral = Carbon::parse($date->format('Y-m-d').' '.$s['end'], self::CENTRAL_TZ)->addDay();
                } else {
                    $endCentral = Carbon::parse($date->format('Y-m-d').' '.$s['end'], self::CENTRAL_TZ);
                }

                Shift::create([
                    'user_id' => $user->id,
                    'workgroup_id' => $dispatch->id,
                    'position_name' => $s['position'],
                    'start_time_utc' => $startCentral->copy()->utc(),
                    'end_time_utc' => $endCentral->copy()->utc(),
                    'regulatory' => $dispatch->regulatory,
                ]);
            }
        }
    }
}
