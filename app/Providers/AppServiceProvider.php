<?php

namespace App\Providers;

use App\Listeners\SetFirstLoginAt;
use App\Models\AppNotification;
use App\Observers\AppNotificationObserver;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        AppNotification::observe(AppNotificationObserver::class);
        Event::listen(Login::class, SetFirstLoginAt::class);
        $this->configureDefaults();
        $this->configureViteDevServerForNetworkAccess();
    }

    /**
     * When running Vite dev server, use the correct URL so assets load when opening the app
     * from another device. Uses VITE_DEV_SERVER_HOST from .env if set (e.g. 192.168.0.80),
     * otherwise when the request host is not localhost, uses the request host.
     */
    protected function configureViteDevServerForNetworkAccess(): void
    {
        if (app()->runningInConsole()) {
            return;
        }

        $hotPath = public_path('hot');
        if (! is_file($hotPath)) {
            return;
        }

        $host = null;
        if (config('app.env') !== 'production' && ($envHost = env('VITE_DEV_SERVER_HOST'))) {
            $host = $envHost;
        } elseif (request() && ($reqHost = request()->getHost()) && ! in_array($reqHost, ['localhost', '127.0.0.1'], true)) {
            $host = $reqHost;
        }

        if (! $host) {
            return;
        }

        $scheme = request() ? request()->getScheme() : 'http';
        $viteDevUrl = $scheme.'://'.trim($host).':5173';
        $storageDir = storage_path('app');
        if (! is_dir($storageDir)) {
            return;
        }
        $tempHotPath = $storageDir.DIRECTORY_SEPARATOR.'vite-hot-'.preg_replace('/[^a-zA-Z0-9._-]/', '-', $host);
        if (file_put_contents($tempHotPath, $viteDevUrl) !== false) {
            Vite::useHotFile($tempHotPath);
        }
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
