<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsDailySnapshot;
use App\Models\AnalyticsShiftHistogramSnapshot;
use App\Services\Analytics\WeekUserActivityService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function index(Request $request, WeekUserActivityService $weekUserActivity): Response
    {
        $tz = config('app.timezone');
        if (! is_string($tz) || $tz === '') {
            $tz = 'UTC';
        }

        $days = (int) $request->query('days', 120);
        $days = (int) min(365, max(7, $days));

        $end = CarbonImmutable::now($tz)->startOfDay();
        $start = $end->subDays($days - 1);

        $snapshots = AnalyticsDailySnapshot::query()
            ->whereBetween('snapshot_date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('snapshot_date')
            ->get()
            ->keyBy(fn ($s) => $s->snapshot_date->toDateString());

        $daily = [];
        $sumSwapSec = 0;
        $sumSwapN = 0;
        $sumLfwSec = 0;
        $sumLfwN = 0;
        $sumSwapCreated = 0;
        $sumSwapResolved = 0;
        $sumLfwCreated = 0;
        $sumLfwResolved = 0;
        $sumOffers = 0;

        for ($d = $start; $d->lte($end); $d = $d->addDay()) {
            $key = $d->toDateString();
            $row = $snapshots->get($key);
            if ($row) {
                $sumSwapSec += (int) $row->swap_resolve_seconds_sum;
                $sumSwapN += (int) $row->swap_resolve_sample_count;
                $sumLfwSec += (int) $row->lfw_resolve_seconds_sum;
                $sumLfwN += (int) $row->lfw_resolve_sample_count;
                $sumSwapCreated += (int) $row->swap_posts_created;
                $sumSwapResolved += (int) $row->swap_posts_resolved;
                $sumLfwCreated += (int) $row->lfw_posts_created;
                $sumLfwResolved += (int) $row->lfw_posts_resolved;
                $sumOffers += (int) $row->swap_offers_created;

                $daily[] = [
                    'date' => $key,
                    'swap_posts_created' => (int) $row->swap_posts_created,
                    'swap_posts_resolved' => (int) $row->swap_posts_resolved,
                    'swap_avg_resolve_hours' => $this->avgHours((int) $row->swap_resolve_seconds_sum, (int) $row->swap_resolve_sample_count),
                    'swap_offers_created' => (int) $row->swap_offers_created,
                    'lfw_posts_created' => (int) $row->lfw_posts_created,
                    'lfw_posts_resolved' => (int) $row->lfw_posts_resolved,
                    'lfw_avg_resolve_hours' => $this->avgHours((int) $row->lfw_resolve_seconds_sum, (int) $row->lfw_resolve_sample_count),
                    'computed_at' => $row->computed_at?->toIso8601String(),
                ];
            } else {
                $daily[] = [
                    'date' => $key,
                    'swap_posts_created' => 0,
                    'swap_posts_resolved' => 0,
                    'swap_avg_resolve_hours' => null,
                    'swap_offers_created' => 0,
                    'lfw_posts_created' => 0,
                    'lfw_posts_resolved' => 0,
                    'lfw_avg_resolve_hours' => null,
                    'computed_at' => null,
                ];
            }
        }

        $asOfQuery = $request->query('as_of');
        $latestAsOf = AnalyticsShiftHistogramSnapshot::query()->max('as_of_date');
        $asOf = $latestAsOf;
        if (is_string($asOfQuery) && $asOfQuery !== '') {
            try {
                $asOf = CarbonImmutable::parse($asOfQuery, $tz)->toDateString();
            } catch (\Throwable) {
                $asOf = $latestAsOf;
            }
        }

        $shiftHistogram = [];
        if ($asOf !== null) {
            $shiftHistogram = AnalyticsShiftHistogramSnapshot::query()
                ->where('as_of_date', $asOf)
                ->orderBy('shift_date')
                ->get()
                ->map(fn ($r) => [
                    'shift_date' => $r->shift_date->toDateString(),
                    'swap_post_count' => (int) $r->swap_post_count,
                ])
                ->values()
                ->all();
        }

        $asOfOptions = AnalyticsShiftHistogramSnapshot::query()
            ->select('as_of_date')
            ->groupBy('as_of_date')
            ->orderByDesc('as_of_date')
            ->limit(90)
            ->pluck('as_of_date')
            ->map(fn ($d) => $d instanceof CarbonInterface ? $d->toDateString() : (string) $d)
            ->values()
            ->all();

        $weekEnd = CarbonImmutable::now($tz)->startOfDay();
        $weekStart = $weekEnd->subDays(6);
        $weekRollup = $this->rollupSnapshotsForRange($weekStart, $weekEnd);

        [$weekStartUtc, $weekEndUtc] = $weekUserActivity->utcBoundsForLocalWeek($weekStart, $weekEnd);
        $weekUserLeaderboard = $weekUserActivity->leaderboard($weekStartUtc, $weekEndUtc, 15);

        $weekUserFocus = null;
        $weekUserInvalid = false;
        if ($request->filled('week_user')) {
            $focusId = (int) $request->query('week_user');
            if ($focusId > 0) {
                $weekUserFocus = $weekUserActivity->userWeekBreakdown($focusId, $weekStartUtc, $weekEndUtc);
                if ($weekUserFocus === null) {
                    $weekUserInvalid = true;
                }
            }
        }

        return Inertia::render('admin/analytics', [
            'timezone' => $tz,
            'window_days' => $days,
            'daily' => $daily,
            'summary' => [
                'swap_posts_created' => $sumSwapCreated,
                'swap_posts_resolved' => $sumSwapResolved,
                'swap_offers_created' => $sumOffers,
                'lfw_posts_created' => $sumLfwCreated,
                'lfw_posts_resolved' => $sumLfwResolved,
                'swap_avg_resolve_hours' => $this->avgHours($sumSwapSec, $sumSwapN),
                'lfw_avg_resolve_hours' => $this->avgHours($sumLfwSec, $sumLfwN),
            ],
            'week_range' => [
                'start' => $weekStart->toDateString(),
                'end' => $weekEnd->toDateString(),
            ],
            'week_summary' => $weekRollup['summary'],
            'week_daily' => $weekRollup['daily'],
            'has_week_data' => $weekRollup['has_data'],
            'week_user_leaderboard' => $weekUserLeaderboard,
            'week_user_focus' => $weekUserFocus,
            'week_user_invalid' => $weekUserInvalid,
            'week_user_id' => $request->filled('week_user') ? (int) $request->query('week_user') : null,
            'shift_histogram' => $shiftHistogram,
            'shift_histogram_as_of' => $asOf,
            'shift_histogram_as_of_options' => $asOfOptions,
            'has_daily_data' => $snapshots->isNotEmpty(),
        ]);
    }

    /**
     * @return array{summary: array<string, mixed>, daily: list<array<string, mixed>>, has_data: bool}
     */
    private function rollupSnapshotsForRange(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $rows = AnalyticsDailySnapshot::query()
            ->whereBetween('snapshot_date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('snapshot_date')
            ->get()
            ->keyBy(fn ($s) => $s->snapshot_date->toDateString());

        $sumSwapSec = 0;
        $sumSwapN = 0;
        $sumLfwSec = 0;
        $sumLfwN = 0;
        $sumSwapCreated = 0;
        $sumSwapResolved = 0;
        $sumLfwCreated = 0;
        $sumLfwResolved = 0;
        $sumOffers = 0;

        $daily = [];
        for ($d = $start; $d->lte($end); $d = $d->addDay()) {
            $key = $d->toDateString();
            $row = $rows->get($key);
            if ($row) {
                $sumSwapSec += (int) $row->swap_resolve_seconds_sum;
                $sumSwapN += (int) $row->swap_resolve_sample_count;
                $sumLfwSec += (int) $row->lfw_resolve_seconds_sum;
                $sumLfwN += (int) $row->lfw_resolve_sample_count;
                $sumSwapCreated += (int) $row->swap_posts_created;
                $sumSwapResolved += (int) $row->swap_posts_resolved;
                $sumLfwCreated += (int) $row->lfw_posts_created;
                $sumLfwResolved += (int) $row->lfw_posts_resolved;
                $sumOffers += (int) $row->swap_offers_created;

                $daily[] = [
                    'date' => $key,
                    'swap_posts_created' => (int) $row->swap_posts_created,
                    'swap_posts_resolved' => (int) $row->swap_posts_resolved,
                    'swap_avg_resolve_hours' => $this->avgHours((int) $row->swap_resolve_seconds_sum, (int) $row->swap_resolve_sample_count),
                    'swap_offers_created' => (int) $row->swap_offers_created,
                    'lfw_posts_created' => (int) $row->lfw_posts_created,
                    'lfw_posts_resolved' => (int) $row->lfw_posts_resolved,
                    'lfw_avg_resolve_hours' => $this->avgHours((int) $row->lfw_resolve_seconds_sum, (int) $row->lfw_resolve_sample_count),
                ];
            } else {
                $daily[] = [
                    'date' => $key,
                    'swap_posts_created' => 0,
                    'swap_posts_resolved' => 0,
                    'swap_avg_resolve_hours' => null,
                    'swap_offers_created' => 0,
                    'lfw_posts_created' => 0,
                    'lfw_posts_resolved' => 0,
                    'lfw_avg_resolve_hours' => null,
                ];
            }
        }

        return [
            'summary' => [
                'swap_posts_created' => $sumSwapCreated,
                'swap_posts_resolved' => $sumSwapResolved,
                'swap_offers_created' => $sumOffers,
                'lfw_posts_created' => $sumLfwCreated,
                'lfw_posts_resolved' => $sumLfwResolved,
                'swap_avg_resolve_hours' => $this->avgHours($sumSwapSec, $sumSwapN),
                'lfw_avg_resolve_hours' => $this->avgHours($sumLfwSec, $sumLfwN),
            ],
            'daily' => $daily,
            'has_data' => $rows->isNotEmpty(),
        ];
    }

    private function avgHours(int $secondsSum, int $n): ?float
    {
        if ($n <= 0) {
            return null;
        }

        return round(($secondsSum / $n) / 3600, 2);
    }
}
