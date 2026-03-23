<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsDailySnapshot;
use App\Models\AnalyticsShiftHistogramSnapshot;
use App\Models\LookingForWorkPost;
use App\Models\SwapOffer;
use App\Models\SwapPost;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class AnalyticsAggregator
{
    private const RESOLVED_SWAP_STATUSES = ['accepted', 'closed'];

    private const RESOLVED_LFW_STATUSES = ['accepted', 'closed'];

    /** Ignore pathological resolution times (seconds). */
    private const MAX_RESOLVE_SECONDS = 86400 * 90;

    public function aggregateDay(CarbonInterface $localDay): void
    {
        $tz = config('app.timezone');
        if (! is_string($tz) || $tz === '') {
            $tz = 'UTC';
        }

        $day = CarbonImmutable::parse($localDay->format('Y-m-d'), $tz)->startOfDay();
        $startUtc = $day->utc();
        $endUtc = $day->endOfDay()->utc();

        $swapCreated = SwapPost::query()->whereBetween('created_at', [$startUtc, $endUtc])->count();

        $swapResolved = SwapPost::query()
            ->whereIn('status', self::RESOLVED_SWAP_STATUSES)
            ->whereBetween('updated_at', [$startUtc, $endUtc])
            ->count();

        [$swapSecSum, $swapN] = $this->sumResolveSeconds(
            SwapPost::query()
                ->whereIn('status', self::RESOLVED_SWAP_STATUSES)
                ->whereBetween('updated_at', [$startUtc, $endUtc])
        );

        $offersCreated = SwapOffer::query()->whereBetween('created_at', [$startUtc, $endUtc])->count();

        $lfwCreated = LookingForWorkPost::query()->whereBetween('created_at', [$startUtc, $endUtc])->count();

        $lfwResolved = LookingForWorkPost::query()
            ->whereIn('status', self::RESOLVED_LFW_STATUSES)
            ->whereBetween('updated_at', [$startUtc, $endUtc])
            ->count();

        [$lfwSecSum, $lfwN] = $this->sumResolveSeconds(
            LookingForWorkPost::query()
                ->whereIn('status', self::RESOLVED_LFW_STATUSES)
                ->whereBetween('updated_at', [$startUtc, $endUtc])
        );

        AnalyticsDailySnapshot::query()->updateOrCreate(
            ['snapshot_date' => $day->toDateString()],
            [
                'swap_posts_created' => $swapCreated,
                'swap_posts_resolved' => $swapResolved,
                'swap_resolve_seconds_sum' => $swapSecSum,
                'swap_resolve_sample_count' => $swapN,
                'swap_offers_created' => $offersCreated,
                'lfw_posts_created' => $lfwCreated,
                'lfw_posts_resolved' => $lfwResolved,
                'lfw_resolve_seconds_sum' => $lfwSecSum,
                'lfw_resolve_sample_count' => $lfwN,
                'computed_at' => now(),
            ]
        );
    }

    /**
     * Snapshot swap post counts by shift calendar day (app timezone) for a 120-day window
     * centered on "today", stored under as_of_date for historical recall.
     */
    public function snapshotShiftHistogram(CarbonInterface $asOfLocalDay): void
    {
        $tz = config('app.timezone');
        if (! is_string($tz) || $tz === '') {
            $tz = 'UTC';
        }

        $asOf = CarbonImmutable::parse($asOfLocalDay->format('Y-m-d'), $tz)->startOfDay();
        $from = $asOf->subDays(60);
        $to = $asOf->addDays(59);

        $counts = [];

        SwapPost::query()
            ->with(['shift' => fn ($q) => $q->select('id', 'start_time_utc')])
            ->orderBy('id')
            ->chunkById(400, function ($posts) use (&$counts, $tz, $from, $to): void {
                foreach ($posts as $post) {
                    $st = $post->shift?->start_time_utc;
                    if ($st === null) {
                        continue;
                    }
                    $d = CarbonImmutable::parse($st)->timezone($tz)->startOfDay();
                    if ($d->lt($from) || $d->gt($to)) {
                        continue;
                    }
                    $key = $d->toDateString();
                    $counts[$key] = ($counts[$key] ?? 0) + 1;
                }
            });

        $asOfStr = $asOf->toDateString();

        DB::transaction(function () use ($asOfStr, $from, $to, $counts): void {
            AnalyticsShiftHistogramSnapshot::query()->where('as_of_date', $asOfStr)->delete();

            $rows = [];
            for ($d = $from; $d->lte($to); $d = $d->addDay()) {
                $ds = $d->toDateString();
                $rows[] = [
                    'as_of_date' => $asOfStr,
                    'shift_date' => $ds,
                    'swap_post_count' => (int) ($counts[$ds] ?? 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            foreach (array_chunk($rows, 100) as $chunk) {
                AnalyticsShiftHistogramSnapshot::query()->insert($chunk);
            }
        });
    }

    /**
     * @param  Builder<Model>  $query
     * @return array{0: int, 1: int}
     */
    private function sumResolveSeconds($query): array
    {
        $sum = 0;
        $n = 0;
        $query->clone()->select(['created_at', 'updated_at'])->orderBy('id')->chunk(500, function ($chunk) use (&$sum, &$n): void {
            foreach ($chunk as $row) {
                $created = $row->created_at;
                $updated = $row->updated_at;
                if ($created === null || $updated === null) {
                    continue;
                }
                $sec = max(0, $updated->getTimestamp() - $created->getTimestamp());
                if ($sec > self::MAX_RESOLVE_SECONDS) {
                    continue;
                }
                $sum += $sec;
                $n++;
            }
        });

        return [$sum, $n];
    }

    public function backfillDaily(CarbonInterface $fromLocalDay, CarbonInterface $toLocalDay): void
    {
        $tz = config('app.timezone');
        if (! is_string($tz) || $tz === '') {
            $tz = 'UTC';
        }
        $from = CarbonImmutable::parse($fromLocalDay->format('Y-m-d'), $tz)->startOfDay();
        $to = CarbonImmutable::parse($toLocalDay->format('Y-m-d'), $tz)->startOfDay();
        for ($d = $from; $d->lte($to); $d = $d->addDay()) {
            $this->aggregateDay($d);
        }
    }
}
