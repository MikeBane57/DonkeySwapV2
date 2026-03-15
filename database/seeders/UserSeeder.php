<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserPreference;
use App\Models\Workgroup;
use App\Models\WorkgroupQualification;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('password');

        $users = [
            [
                'email' => 'mike@example.com',
                'name' => 'Mike',
                'role' => 'admin',
                'email_verified_at' => now(),
                'workgroups' => [
                    'Dispatch' => ['dsp' => true, 'classification_seniority_date' => now()->subYears(2)],
                    'Ramp' => ['dsp' => false, 'classification_seniority_date' => now()->subYears(2)],
                ],
            ],
            [
                'email' => 'jordan@example.com',
                'name' => 'Jordan',
                'role' => 'manager',
                'email_verified_at' => now(),
                'workgroups' => [
                    'Dispatch' => ['dsp' => true, 'classification_seniority_date' => now()->subYear()],
                    'Ramp' => ['dsp' => false, 'classification_seniority_date' => now()->subYear()],
                ],
            ],
            [
                'email' => 'sam@example.com',
                'name' => 'Sam',
                'role' => 'worker',
                'email_verified_at' => now(),
                'workgroups' => [
                    'Dispatch' => ['dsp' => false, 'classification_seniority_date' => now()->subMonths(6)],
                    'Ramp' => ['dsp' => false, 'classification_seniority_date' => now()->subMonths(6)],
                ],
            ],
            [
                'email' => 'riley@example.com',
                'name' => 'Riley',
                'role' => 'worker',
                'email_verified_at' => now(),
                'workgroups' => [
                    'Dispatch' => ['dsp' => true, 'classification_seniority_date' => now()->subMonths(9)],
                    'Ramp' => ['dsp' => false, 'classification_seniority_date' => now()->subMonths(9)],
                ],
            ],
        ];

        foreach ($users as $u) {
            $workgroups = $u['workgroups'];
            unset($u['workgroups']);

            $user = User::updateOrCreate(
                ['email' => $u['email']],
                array_merge($u, ['password' => $password])
            );

            $user->workgroups()->detach();
            $user->workgroupQualifications()->detach();
            foreach ($workgroups as $wgName => $opts) {
                $wg = Workgroup::where('name', $wgName)->first();
                if ($wg) {
                    $user->workgroups()->attach($wg->id, [
                        'classification_seniority_date' => $opts['classification_seniority_date'] ?? null,
                    ]);
                    if (! empty($opts['dsp'])) {
                        $dsp = WorkgroupQualification::where('workgroup_id', $wg->id)->where('code', 'DSP')->first();
                        if ($dsp) {
                            $user->workgroupQualifications()->syncWithoutDetaching([$dsp->id]);
                        }
                    }
                }
            }
        }

        $sam = User::where('email', 'sam@example.com')->first();
        if ($sam) {
            UserPreference::updateOrCreate(
                ['user_id' => $sam->id],
                [
                    'preferred_shift_type' => 'am',
                    'willing_double_am_pm' => false,
                    'willing_double_pm_midnight' => false,
                    'willing_double_midnight_am' => false,
                ]
            );
        }
    }
}
