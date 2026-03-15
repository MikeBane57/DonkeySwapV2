<?php

use App\Http\Controllers\Admin\AppIconController;
use App\Http\Controllers\Admin\MessageCenterController;
use App\Http\Controllers\Admin\PostManagerController;
use App\Http\Controllers\Admin\RedLinesController;
use App\Http\Controllers\Admin\ShiftsController;
use App\Http\Controllers\Admin\UserManagerController;
use App\Http\Controllers\Admin\WorkgroupsController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\NotificationsController;
use App\Http\Controllers\Api\OfferController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\SwapPostController;
use App\Http\Controllers\Api\TimeOffRangeController;
use App\Http\Controllers\App\AvailableController;
use App\Http\Controllers\App\DashboardController;
use App\Http\Controllers\App\NotificationsController as AppNotificationsController;
use App\Http\Controllers\LandingController;
use App\Models\Setting;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

// Public landing (no auth, no navbar)
Route::get('/', LandingController::class)->name('home');

// PWA web app manifest (needed for home screen install and badge support)
Route::get('/manifest.webmanifest', function () {
    $iconUrl = asset(Setting::appIconUrl());

    return response()->json([
        'name' => config('app.name'),
        'short_name' => config('app.name'),
        'start_url' => url('/app'),
        'display' => 'standalone',
        'background_color' => '#ffffff',
        'theme_color' => '#1b1b18',
        'icons' => [
            [
                'src' => $iconUrl,
                'sizes' => '512x512',
                'type' => 'image/png',
                'purpose' => 'any maskable',
            ],
        ],
    ], 200, [
        'Content-Type' => 'application/manifest+json',
        'Cache-Control' => 'public, max-age=3600',
    ]);
})->name('manifest');

// Auth routes (login, register, etc.) - remain at root per Fortify
// Redirect legacy welcome to landing
Route::get('/welcome', fn () => redirect('/'))->name('welcome');

// API routes (session auth, for polling & export)
Route::prefix('api')->middleware(['auth'])->group(function () {
    Route::post('banner-messages/{bannerMessage}/acknowledge', [\App\Http\Controllers\Api\BannerMessageController::class, 'acknowledge'])->name('api.banner.acknowledge');
    Route::get('notifications/unread', [NotificationsController::class, 'unread'])->name('api.notifications.unread');
    Route::patch('notifications/{notification}/read', [NotificationsController::class, 'markRead'])->name('api.notifications.mark-read');
    Route::post('notifications/read-all', [NotificationsController::class, 'markAllRead'])->name('api.notifications.mark-all-read');
    Route::post('push-subscription', [PushSubscriptionController::class, 'store'])->name('api.push-subscription.store');
    Route::delete('push-subscription', [PushSubscriptionController::class, 'destroy'])->name('api.push-subscription.destroy');
    Route::get('export/ics', [ExportController::class, 'ics'])->name('api.export.ics');
    Route::get('calendar/events', [CalendarController::class, 'events'])->name('api.calendar.events');
    Route::post('shifts', [ShiftController::class, 'store'])->name('api.shifts.store');
    Route::delete('shifts/{shift}', [ShiftController::class, 'destroy'])->name('api.shifts.destroy');
    Route::post('shifts/{shift}/postings', [SwapPostController::class, 'store'])->name('api.postings.store');
    Route::get('shifts/{shift}/post-history', [SwapPostController::class, 'history'])->name('api.postings.history');
    Route::post('postings/bulk', [SwapPostController::class, 'storeBulk'])->name('api.postings.bulk');
    Route::delete('posts/{post}', [SwapPostController::class, 'destroy'])->name('api.postings.destroy');
    Route::post('posts/{post}/offer', [SwapPostController::class, 'offer'])->name('api.postings.offer');
    Route::post('posts/{post}/hide', [\App\Http\Controllers\Api\HiddenPostController::class, 'hide'])->name('api.posts.hide');
    Route::post('posts/unhide-all', [\App\Http\Controllers\Api\HiddenPostController::class, 'unhideAll'])->name('api.posts.unhide-all');
    Route::post('offers/{offer}/accept', [OfferController::class, 'accept'])->name('api.offers.accept');
    Route::post('offers/{offer}/reject', [OfferController::class, 'reject'])->name('api.offers.reject');
    Route::post('offers/{offer}/withdraw', [OfferController::class, 'withdraw'])->name('api.offers.withdraw');
    Route::get('time-off-ranges', [TimeOffRangeController::class, 'index'])->name('api.time-off-ranges.index');
    Route::post('time-off-ranges', [TimeOffRangeController::class, 'store'])->name('api.time-off-ranges.store');
    Route::delete('time-off-ranges/{userTimeOffRange}', [TimeOffRangeController::class, 'destroy'])->name('api.time-off-ranges.destroy');
    Route::get('available/eligible-counts', [AvailableController::class, 'eligibleCounts'])->name('api.available.eligible-counts');
    Route::get('available/dates-with-eligible-giveaway', [AvailableController::class, 'datesWithEligibleGiveaway'])->name('api.available.dates-with-eligible-giveaway');
});

// Authenticated app routes under /app
Route::middleware(['auth', 'verified'])->prefix('app')->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('available', [AvailableController::class, 'index'])->name('available');
    Route::get('notifications', [AppNotificationsController::class, 'index'])->name('notifications');
    Route::redirect('dashboard', '/app');
    Route::redirect('calendar', '/app')->name('calendar');

    // Admin panel (admin role required)
    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        Route::inertia('/', 'admin/index')->name('index');
        Route::get('users', [UserManagerController::class, 'index'])->name('users');
        Route::post('users', [UserManagerController::class, 'store'])->name('users.store');
        Route::put('users/{user}', [UserManagerController::class, 'update'])->name('users.update');
        Route::post('workgroups', [WorkgroupsController::class, 'store'])->name('workgroups.store');
        Route::get('workgroups', [WorkgroupsController::class, 'index'])->name('workgroups');
        Route::put('workgroups/{workgroup}', [WorkgroupsController::class, 'update'])->name('workgroups.update');
        Route::delete('workgroups/{workgroup}', [WorkgroupsController::class, 'destroy'])->name('workgroups.destroy');
        Route::post('red-lines', [RedLinesController::class, 'store'])->name('red-lines.store');
        Route::get('red-lines', [RedLinesController::class, 'index'])->name('red-lines');
        Route::put('red-lines/{red_line}', [RedLinesController::class, 'update'])->name('red-lines.update');
        Route::delete('red-lines/{red_line}', [RedLinesController::class, 'destroy'])->name('red-lines.destroy');
        Route::get('shifts', [ShiftsController::class, 'index'])->name('shifts');
        Route::post('shifts', [ShiftsController::class, 'store'])->name('shifts.store');
        Route::post('shifts/by-rotation', [ShiftsController::class, 'storeByRotation'])->name('shifts.store-by-rotation');
        Route::delete('shifts/{shift}', [ShiftsController::class, 'destroy'])->name('shifts.destroy');
        Route::post('shifts/bulk-destroy', [ShiftsController::class, 'bulkDestroy'])->name('shifts.bulk-destroy');
        Route::post('shifts/bulk-move', [ShiftsController::class, 'bulkMove'])->name('shifts.bulk-move');
        Route::get('posts', [PostManagerController::class, 'index'])->name('posts');
        Route::put('posts/{post}', [PostManagerController::class, 'update'])->name('posts.update');
        Route::delete('posts/{post}', [PostManagerController::class, 'destroy'])->name('posts.destroy');
        Route::put('shifts/{shift}/posts-status', [PostManagerController::class, 'updateShiftPostsStatus'])->name('shifts.posts-status');
        Route::delete('shifts/{shift}/posts', [PostManagerController::class, 'destroyShiftPosts'])->name('shifts.posts.destroy');
        Route::get('message-center', [MessageCenterController::class, 'index'])->name('message-center');
        Route::post('message-center', [MessageCenterController::class, 'store'])->name('message-center.store');
        Route::delete('message-center/banners/{banner}', [MessageCenterController::class, 'destroyBanner'])->name('message-center.banners.destroy');
        Route::delete('message-center/notification-batches/{batch}', [MessageCenterController::class, 'destroyNotificationBatch'])->name('message-center.notification-batches.destroy');
        Route::get('app-icon', [AppIconController::class, 'index'])->name('app-icon');
        Route::post('app-icon', [AppIconController::class, 'store'])->name('app-icon.store');
        Route::post('app-icon/set-current', [AppIconController::class, 'setCurrent'])->name('app-icon.set-current');
    });

    require __DIR__.'/settings.php';
});
