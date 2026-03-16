<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    /**
     * Get a setting value (cached). Returns null if not set.
     */
    public static function get(string $key): ?string
    {
        $cacheKey = 'setting:'.$key;

        try {
            return Cache::remember($cacheKey, 3600, function () use ($key) {
                $row = static::query()->where('key', $key)->first();

                return $row?->value;
            });
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Set a setting value and clear cache.
     */
    public static function set(string $key, ?string $value): void
    {
        static::query()->updateOrInsert(
            ['key' => $key],
            ['value' => $value]
        );
        Cache::forget('setting:'.$key);
    }

    /**
     * Effective app icon URL: from settings if set, otherwise config default.
     */
    public static function appIconUrl(): string
    {
        $value = static::get('app_icon_url');
        if ($value !== null && $value !== '') {
            return $value;
        }

        return config('app.icon_url', '/images/donkey-swap-logo.png');
    }
}
