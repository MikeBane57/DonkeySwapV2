<?php

namespace App\Listeners;

use App\Models\User;
use Illuminate\Auth\Events\Login;

class SetFirstLoginAt
{
    /**
     * Record first login time and flash a one-time tutorial prompt for the next request.
     */
    public function handle(Login $event): void
    {
        $user = $event->user;
        if (! $user instanceof User) {
            return;
        }

        if ($user->first_login_at === null) {
            $user->first_login_at = now();
            $user->save();
            session()->flash('first_login_tutorial', true);
        }
    }
}
