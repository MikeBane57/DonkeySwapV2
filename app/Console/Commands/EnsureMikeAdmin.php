<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class EnsureMikeAdmin extends Command
{
    protected $signature = 'app:ensure-mike-admin';

    protected $description = 'Ensure user Mike (mike@example.com) exists as admin with password "password" and verified email.';

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->warn('This command is disabled in production to avoid creating a default admin account.');

            return self::SUCCESS;
        }

        User::updateOrCreate(
            ['email' => 'mike@example.com'],
            [
                'name' => 'Mike',
                'role' => 'admin',
                'password' => bcrypt('password'),
                'email_verified_at' => now(),
            ]
        );

        $this->info('Mike is set as admin. Log in at /login with mike@example.com / password');

        return self::SUCCESS;
    }
}
