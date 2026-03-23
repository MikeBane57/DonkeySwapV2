<?php

namespace App\Console\Commands;

use App\Services\Analytics\AnalyticsAggregator;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class AnalyticsAggregate extends Command
{
    protected $signature = 'analytics:aggregate
                            {--from= : Start date (Y-m-d) for daily backfill}
                            {--to= : End date (Y-m-d) for daily backfill}
                            {--skip-histogram : Skip shift histogram snapshot}
                            {--histogram-only : Only run shift histogram}';

    protected $description = 'Persist daily analytics snapshots and optional shift-date histogram (120-day window).';

    public function handle(AnalyticsAggregator $aggregator): int
    {
        $tz = config('app.timezone');
        if (! is_string($tz) || $tz === '') {
            $tz = 'UTC';
        }

        $histogramOnly = (bool) $this->option('histogram-only');
        $skipHistogram = (bool) $this->option('skip-histogram');

        if ($histogramOnly) {
            $aggregator->snapshotShiftHistogram(now($tz));
            $this->info('Shift histogram snapshot complete.');

            return self::SUCCESS;
        }

        $from = $this->option('from');
        $to = $this->option('to');
        if ($from !== null && $from !== '' && $to !== null && $to !== '') {
            $aggregator->backfillDaily(
                CarbonImmutable::parse($from, $tz)->startOfDay(),
                CarbonImmutable::parse($to, $tz)->startOfDay()
            );
            $this->info('Daily snapshots backfilled from '.$from.' to '.$to.'.');
        } else {
            $yesterday = now($tz)->subDay()->startOfDay();
            $aggregator->aggregateDay($yesterday);
            $this->info('Daily snapshot for '.$yesterday->toDateString().' complete.');
        }

        if (! $skipHistogram) {
            $aggregator->snapshotShiftHistogram(now($tz));
            $this->info('Shift histogram snapshot complete.');
        }

        return self::SUCCESS;
    }
}
