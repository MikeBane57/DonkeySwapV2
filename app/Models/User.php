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
        'role',
        'dispatch_master_seniority_date',
        'time_display_preference',
        'first_login_at',
        'tutorial_progress',
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
            'first_login_at' => 'datetime',
            'tutorial_progress' => 'array',
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

    /**
     * @return list<string>
     */
    public function seenTutorialFeatureIds(): array
    {
        $ids = $this->tutorial_progress['seen_feature_ids'] ?? [];

        return is_array($ids) ? array_values(array_filter($ids, fn ($id) => is_string($id))) : [];
    }

    /**
     * @param  list<string>  $featureIds
     */
    public function markTutorialFeaturesSeen(array $featureIds): void
    {
        $progress = $this->tutorial_progress ?? [];
        $existing = $progress['seen_feature_ids'] ?? [];
        if (! is_array($existing)) {
            $existing = [];
        }
        $progress['seen_feature_ids'] = array_values(array_unique(array_merge($existing, $featureIds)));
        $this->tutorial_progress = $progress;
        $this->save();
    }
}
