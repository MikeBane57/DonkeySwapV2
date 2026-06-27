<?php

use App\Http\Controllers\Admin\ActiveSessionsController;
use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\AppIconController;
use App\Http\Controllers\Admin\BidLineImportController;
use App\Http\Controllers\Admin\MessageCenterController;
use App\Http\Controllers\Admin\PostManagerController;
use App\Http\Controllers\Admin\RedLinesController;
use App\Http\Controllers\Admin\ScheduleImportController;
use App\Http\Controllers\Admin\ShiftsController;
use App\Http\Controllers\Admin\UserManagerController;
use App\Http\Controllers\Admin\WorkgroupsController;
use App\Http\Controllers\Api\BannerMessageController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\HiddenPostController;
use App\Http\Controllers\Api\LfwDateRangeController;
use App\Http\Controllers\Api\NotificationsController;
use App\Http\Controllers\Api\OfferController;
use App\Http\Controllers\Api\OthersBoardsCalendarController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\ScheduleImportController as ApiScheduleImportController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\SwapPostController;
use App\Http\Controllers\Api\TimeOffRangeController;
use App\Http\Controllers\App\AvailableController;
use App\Http\Controllers\App\BidTools\HubController as BidToolsHubController;
use App\Http\Controllers\App\BidTools\LineBrowserController;
use App\Http\Controllers\App\BidTools\RankedController as BidToolsRankedController;
use App\Http\Controllers\App\BidTools\ScenarioCompareController as BidToolsScenarioCompareController;
use App\Http\Controllers\App\BidTools\ScenarioController as BidToolsScenarioController;
use App\Http\Controllers\App\BidTools\SimulationController as BidToolsSimulationController;
use App\Http\Controllers\App\DashboardController;
use App\Http\Controllers\App\LookingForWorkController;
use App\Http\Controllers\App\NotificationsController as AppNotificationsController;
use App\Http\Controllers\App\OthersBoardsController;
use App\Http\Controllers\App\ReconcileScheduleController;
use App\Http\Controllers\App\TutorialController;
use App\Http\Controllers\LandingController;
use App\Models\Setting;
use Illuminate\Support\Facades\Route;

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
    Route::post('banner-messages/{bannerMessage}/acknowledge', [BannerMessageController::class, 'acknowledge'])->name('api.banner.acknowledge');
    Route::get('notifications/unread', [NotificationsController::class, 'unread'])->name('api.notifications.unread');
    Route::patch('notifications/{notification}/read', [NotificationsController::class, 'markRead'])->name('api.notifications.mark-read');
    Route::post('notifications/read-all', [NotificationsController::class, 'markAllRead'])->name('api.notifications.mark-all-read');
    Route::post('push-subscription', [PushSubscriptionController::class, 'store'])->name('api.push-subscription.store');
    Route::delete('push-subscription', [PushSubscriptionController::class, 'destroy'])->name('api.push-subscription.destroy');
    Route::get('export/ics', [ExportController::class, 'ics'])->name('api.export.ics');
    Route::get('calendar/events', [CalendarController::class, 'events'])->name('api.calendar.events');
    Route::get('others-boards/users', [OthersBoardsCalendarController::class, 'eligibleUsers'])->name('api.others-boards.users');
    Route::get('others-boards/overlay', [OthersBoardsCalendarController::class, 'overlay'])->name('api.others-boards.overlay');
    Route::post('shifts', [ShiftController::class, 'store'])->name('api.shifts.store');
    Route::patch('shifts/{shift}', [ShiftController::class, 'update'])->name('api.shifts.update');
    Route::delete('shifts/{shift}', [ShiftController::class, 'destroy'])->name('api.shifts.destroy');
    Route::post('shifts/{shift}/postings', [SwapPostController::class, 'store'])->name('api.postings.store');
    Route::get('shifts/{shift}/post-history', [SwapPostController::class, 'history'])->name('api.postings.history');
    Route::post('postings/bulk', [SwapPostController::class, 'storeBulk'])->name('api.postings.bulk');
    Route::delete('posts/{post}', [SwapPostController::class, 'destroy'])->name('api.postings.destroy');
    Route::post('posts/{post}/offer', [SwapPostController::class, 'offer'])->name('api.postings.offer');
    Route::post('posts/{post}/hide', [HiddenPostController::class, 'hide'])->name('api.posts.hide');
    Route::post('posts/unhide-all', [HiddenPostController::class, 'unhideAll'])->name('api.posts.unhide-all');
    Route::post('offers/{offer}/accept', [OfferController::class, 'accept'])->name('api.offers.accept');
    Route::post('offers/{offer}/reject', [OfferController::class, 'reject'])->name('api.offers.reject');
    Route::post('offers/{offer}/withdraw', [OfferController::class, 'withdraw'])->name('api.offers.withdraw');
    Route::get('time-off-ranges', [TimeOffRangeController::class, 'index'])->name('api.time-off-ranges.index');
    Route::post('time-off-ranges', [TimeOffRangeController::class, 'store'])->name('api.time-off-ranges.store');
    Route::delete('time-off-ranges/{userTimeOffRange}', [TimeOffRangeController::class, 'destroy'])->name('api.time-off-ranges.destroy');
    Route::get('lfw-date-ranges', [LfwDateRangeController::class, 'index'])->name('api.lfw-date-ranges.index');
    Route::post('lfw-date-ranges', [LfwDateRangeController::class, 'store'])->name('api.lfw-date-ranges.store');
    Route::delete('lfw-date-ranges/{userLfwDateRange}', [LfwDateRangeController::class, 'destroy'])->name('api.lfw-date-ranges.destroy');
    Route::get('available/eligible-counts', [AvailableController::class, 'eligibleCounts'])->name('api.available.eligible-counts');
    Route::get('available/dates-with-eligible-giveaway', [AvailableController::class, 'datesWithEligibleGiveaway'])->name('api.available.dates-with-eligible-giveaway');
    Route::get('looking-for-work/posts-for-date', [LookingForWorkController::class, 'postsForDate'])->name('api.looking-for-work.posts-for-date');
    Route::post('looking-for-work/posts', [LookingForWorkController::class, 'store'])->name('api.looking-for-work.posts.store');
    Route::post('looking-for-work/posts/bulk', [LookingForWorkController::class, 'storeBulk'])->name('api.looking-for-work.posts.bulk');
    Route::put('looking-for-work/posts/{looking_for_work_post}', [LookingForWorkController::class, 'update'])->name('api.looking-for-work.posts.update');
    Route::delete('looking-for-work/posts/{looking_for_work_post}', [LookingForWorkController::class, 'destroy'])->name('api.looking-for-work.posts.destroy');
    Route::post('looking-for-work/posts/{looking_for_work_post}/offers', [LookingForWorkController::class, 'offer'])->name('api.looking-for-work.offers.store');
    Route::post('looking-for-work/offers/{looking_for_work_offer}/accept', [LookingForWorkController::class, 'acceptOffer'])->name('api.looking-for-work.offers.accept');
    Route::post('looking-for-work/offers/{looking_for_work_offer}/reject', [LookingForWorkController::class, 'rejectOffer'])->name('api.looking-for-work.offers.reject');
    Route::post('looking-for-work/offers/{looking_for_work_offer}/withdraw', [LookingForWorkController::class, 'withdrawOffer'])->name('api.looking-for-work.offers.withdraw');
    Route::put('looking-for-work/offers/{looking_for_work_offer}', [LookingForWorkController::class, 'updateOffer'])->name('api.looking-for-work.offers.update');
    Route::post('schedule-import/preview', [ApiScheduleImportController::class, 'preview'])->name('api.schedule-import.preview')->middleware('throttle:10,1');
    Route::post('schedule-import/apply', [ApiScheduleImportController::class, 'apply'])->name('api.schedule-import.apply')->middleware('throttle:10,1');
    Route::get('schedule-import/history', [ApiScheduleImportController::class, 'history'])->name('api.schedule-import.history');
});

// Authenticated app routes under /app
Route::middleware(['auth', 'verified'])->prefix('app')->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('others-boards', [OthersBoardsController::class, 'index'])->name('others-boards');
    Route::get('available', [AvailableController::class, 'index'])->name('available');
    Route::get('looking-for-work', [LookingForWorkController::class, 'index'])->name('looking-for-work');
    Route::get('notifications', [AppNotificationsController::class, 'index'])->name('notifications');
    Route::post('tutorial/mark-seen', [TutorialController::class, 'markSeen'])->name('tutorial.mark-seen');
    Route::redirect('dashboard', '/app');
    Route::redirect('calendar', '/app')->name('calendar');

    Route::get('reconcile-schedule', [ReconcileScheduleController::class, 'index'])->name('reconcile-schedule.index');
    Route::get('reconcile-schedule/{reconcile_schedule}', [ReconcileScheduleController::class, 'show'])->name('reconcile-schedule.show');
    Route::post('reconcile-schedule/{reconcile_schedule}', [ReconcileScheduleController::class, 'store'])->name('reconcile-schedule.store');

    Route::middleware('feature:bid_tools')->prefix('bid-tools')->name('bid-tools.')->group(function () {
        Route::get('/', BidToolsHubController::class)->name('index');
        Route::get('/lines', LineBrowserController::class)->name('lines.index');
        Route::get('/scenarios/compare', [BidToolsScenarioCompareController::class, 'show'])->name('scenarios.compare');
        Route::post('/scenarios/compare', [BidToolsScenarioCompareController::class, 'compare'])->name('scenarios.compare.run');
        Route::get('/scenarios/create', [BidToolsScenarioController::class, 'create'])->name('scenarios.create');
        Route::post('/scenarios', [BidToolsScenarioController::class, 'store'])->name('scenarios.store');
        Route::get('/scenarios/{scenario}/edit', [BidToolsScenarioController::class, 'edit'])->name('scenarios.edit');
        Route::put('/scenarios/{scenario}', [BidToolsScenarioController::class, 'update'])->name('scenarios.update');
        Route::post('/scenarios/{scenario}/duplicate', [BidToolsScenarioController::class, 'duplicate'])->name('scenarios.duplicate');
        Route::delete('/scenarios/{scenario}', [BidToolsScenarioController::class, 'destroy'])->name('scenarios.destroy');
        Route::get('/scenarios/{scenario}/ranked', [BidToolsRankedController::class, 'show'])->name('scenarios.ranked');
        Route::post('/scenarios/{scenario}/score', [BidToolsRankedController::class, 'score'])->name('scenarios.score');
        Route::patch('/scenarios/{scenario}/lines/{line}/submitted', [BidToolsRankedController::class, 'updateSubmitted'])->name('scenarios.line-submitted');

        Route::get('/simulations', [BidToolsSimulationController::class, 'index'])->name('simulations.index');
        Route::get('/simulations/create', [BidToolsSimulationController::class, 'create'])->name('simulations.create');
        Route::post('/simulations', [BidToolsSimulationController::class, 'store'])->name('simulations.store');
        Route::get('/simulations/{simulation}', [BidToolsSimulationController::class, 'show'])->name('simulations.show');
        Route::get('/simulations/{simulation}/edit', [BidToolsSimulationController::class, 'edit'])->name('simulations.edit');
        Route::put('/simulations/{simulation}', [BidToolsSimulationController::class, 'update'])->name('simulations.update');
        Route::delete('/simulations/{simulation}', [BidToolsSimulationController::class, 'destroy'])->name('simulations.destroy');
        Route::post('/simulations/{simulation}/participants', [BidToolsSimulationController::class, 'storeParticipant'])->name('simulations.participants.store');
        Route::put('/simulations/{simulation}/participants/{participant}', [BidToolsSimulationController::class, 'updateParticipant'])->name('simulations.participants.update');
        Route::delete('/simulations/{simulation}/participants/{participant}', [BidToolsSimulationController::class, 'destroyParticipant'])->name('simulations.participants.destroy');
        Route::post('/simulations/{simulation}/run', [BidToolsSimulationController::class, 'run'])->name('simulations.run');
        Route::get('/simulations/{simulation}/participants/{participant}/recommendations', [BidToolsSimulationController::class, 'recommendations'])->name('simulations.participants.recommendations');
    });

    // Admin panel (admin role required)
    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        Route::inertia('/', 'admin/index')->name('index');
        Route::get('analytics', [AnalyticsController::class, 'index'])->name('analytics');
        Route::get('active-sessions', [ActiveSessionsController::class, 'index'])->name('active-sessions');
        Route::get('users', [UserManagerController::class, 'index'])->name('users');
        Route::post('users', [UserManagerController::class, 'store'])->name('users.store');
        Route::post('users/import', [UserManagerController::class, 'import'])->name('users.import');
        Route::post('users/{user}/reset-password', [UserManagerController::class, 'resetPasswordToDefault'])->name('users.reset-password');
        Route::put('users/{user}', [UserManagerController::class, 'update'])->name('users.update');
        Route::delete('users/{user}', [UserManagerController::class, 'destroy'])->name('users.destroy');
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
        Route::post('message-center/banners/bulk-destroy', [MessageCenterController::class, 'bulkDestroyBanners'])->name('message-center.banners.bulk-destroy');
        Route::delete('message-center/notification-batches/{batch}', [MessageCenterController::class, 'destroyNotificationBatch'])->name('message-center.notification-batches.destroy');
        Route::post('message-center/notification-batches/bulk-destroy', [MessageCenterController::class, 'bulkDestroyNotificationBatches'])->name('message-center.notification-batches.bulk-destroy');
        Route::get('message-center/users/{user}/notifications', [MessageCenterController::class, 'userNotifications'])->name('message-center.user-notifications');
        Route::post('message-center/users/{user}/notifications/clear-badge', [MessageCenterController::class, 'clearBadgeForUser'])->name('message-center.user-clear-badge');
        Route::post('message-center/notifications/{notification}/push', [MessageCenterController::class, 'pushNotification'])->name('message-center.notifications.push');
        Route::delete('message-center/notifications/{notification}', [MessageCenterController::class, 'destroyNotification'])->name('message-center.notifications.destroy');
        Route::get('app-icon', [AppIconController::class, 'index'])->name('app-icon');
        Route::post('app-icon', [AppIconController::class, 'store'])->name('app-icon.store');
        Route::post('app-icon/set-current', [AppIconController::class, 'setCurrent'])->name('app-icon.set-current');
        Route::get('import-bulk', [ScheduleImportController::class, 'bulkPage'])->name('import-bulk');
        Route::get('import-history', [ScheduleImportController::class, 'index'])->name('import-history');
        Route::get('import-history/{schedule_import_run}', [ScheduleImportController::class, 'show'])->name('import-history.show');
        Route::get('import-audit', [ScheduleImportController::class, 'audit'])->name('import-audit');
        Route::get('import-unmapped-codes', [ScheduleImportController::class, 'unmapped'])->name('import-unmapped-codes');
        Route::delete('schedule-import/unmapped-codes/{schedule_unmapped_code}', [ScheduleImportController::class, 'destroyUnmapped'])->name('schedule-import.unmapped.destroy');
        Route::post('schedule-import/unmapped-codes/bulk-destroy', [ScheduleImportController::class, 'bulkDestroyUnmapped'])->name('schedule-import.unmapped.bulk-destroy');
        Route::post('schedule-import/unmapped-codes/clear-all', [ScheduleImportController::class, 'clearAllUnmapped'])->name('schedule-import.unmapped.clear-all');
        Route::post('schedule-import/unmapped-add-to-workgroup', [ScheduleImportController::class, 'unmappedAddToWorkgroup'])->name('schedule-import.unmapped-add-to-workgroup');
        Route::post('schedule-import/bulk-preview', [ScheduleImportController::class, 'bulkPreview'])->name('schedule-import.bulk-preview')->middleware('throttle:10,1');
        Route::post('schedule-import/bulk-apply', [ScheduleImportController::class, 'bulkApply'])->name('schedule-import.bulk-apply')->middleware('throttle:10,1');
        Route::post('schedule-import/master-compare', [ScheduleImportController::class, 'masterCompare'])->name('schedule-import.master-compare')->middleware('throttle:10,1');
        Route::post('schedule-import/master-apply', [ScheduleImportController::class, 'masterApply'])->name('schedule-import.master-apply')->middleware('throttle:10,1');

        Route::middleware('feature:bid_tools')->group(function () {
            Route::get('bid-lines', [BidLineImportController::class, 'index'])->name('bid-lines.index');
            Route::post('bid-lines', [BidLineImportController::class, 'store'])->name('bid-lines.store')->middleware('throttle:10,1');
        });
    });

    require __DIR__.'/settings.php';
});
