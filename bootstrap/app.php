<?php

use App\Http\Middleware\ContentSecurityPolicy;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\TrackClientSessionContext;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state', 'ds_client_ctx']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            ContentSecurityPolicy::class,
            TrackClientSessionContext::class,
        ]);

        $middleware->alias(['admin' => EnsureAdmin::class]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('analytics:aggregate')->dailyAt('01:25');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->renderable(function (Throwable $e, $request) {
            if (! $request->expectsJson() || ! app()->hasDebugModeEnabled()) {
                return null;
            }
            $status = $e instanceof HttpException
                ? $e->getStatusCode()
                : 500;

            return response()->json([
                'message' => $e->getMessage(),
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ], $status);
        });
    })->create();
