<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use NotificationChannels\WebPush\HasPushSubscriptions;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasPushSubscriptions, Notifiable, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'employee_id',
        'phone',
        'preferred_contact_method',
        'password',
        'dispatch_master_seniority_date',
        'time_display_preference',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'dispatch_master_seniority_date' => 'date',
        ];
    }

    public function workgroups()
    {
        return $this->belongsToMany(Workgroup::class, 'user_workgroups')
            ->withPivot('classification_seniority_date', 'red_line_seniority_number')
            ->withTimestamps();
    }

    public function workgroupQualifications(): BelongsToMany
    {
        return $this->belongsToMany(WorkgroupQualification::class, 'user_workgroup_qualifications')
            ->withTimestamps();
    }

    public function shifts()
    {
        return $this->hasMany(Shift::class);
    }

    public function swapPosts()
    {
        return $this->hasMany(SwapPost::class, 'user_id', 'id');
    }
}
