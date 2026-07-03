<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidLineDay;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class LineMetricsService
{
    public function __construct(
        private readonly FederalHolidayCalendar $holidays,
    ) {}

    /**
     * @return array{
     *   holidays_off: int,
     *   key_holidays: array<string, array{
     *     off: int,
     *     total: int,
     *     anchor_label: string|null,
     *     anchor_off: bool,
     *     days_off_before: int,
     *     days_off_after: int,
     *     dates: list<array{
     *       id: string,
     *       label: string,
     *       short_label: string,
     *       off: bool,
     *       days_off_before: int,
     *       days_off_after: int,
     *     }>,
     *   }>,
     *   fri_off: int,
     *   sat_off: int,
     *   sun_off: int,
     *   fri_sat_sun_all_off: int,
     *   sat_sun_both_off: int,
     *   sept_feb: array{
     *     fri_off: int,
     *     sat_off: int,
     *     sun_off: int,
     *     fri_sat_sun_all_off: int,
     *     sat_sun_both_off: int,
     *   },
     * }
     */
    public function analyze(BidLine $line): array
    {
        $line->loadMissing('import');
        $bidYear = (int) $line->import->bid_year;
        $bidRange = BidYearRange::fromBidYear($bidYear);
        $holidayCatalog = $this->holidays->holidaysInBidYear($bidYear);
        $holidayDates = $holidayCatalog->keys()->all();

        $days = $this->orderedDays($line);
        $byDate = [];
        foreach ($days as $d) {
            $ymd = $d->assignment_date->format('Y-m-d');
            $byDate[$ymd] = $d->is_off;
        }

        $holidaysOff = 0;
        foreach ($holidayDates as $h) {
            if (($byDate[$h] ?? false) === true) {
                $holidaysOff++;
            }
        }

        $keyHolidays = [];
        foreach (FederalHolidayCalendar::KEY_HOLIDAY_GROUPS as $group => $ids) {
            $total = 0;
            $off = 0;
            $anchorDate = null;
            $anchorLabel = null;
            $anchorId = FederalHolidayCalendar::KEY_HOLIDAY_ANCHOR_IDS[$group] ?? null;
            $dateRows = [];

            foreach ($holidayCatalog as $date => $meta) {
                if ($anchorId !== null && $meta['id'] === $anchorId) {
                    $anchorDate = $date;
                    $anchorLabel = $meta['label'];
                }

                if (! in_array($meta['id'], $ids, true)) {
                    continue;
                }

                $isOff = ($byDate[$date] ?? false) === true;
                $dateContext = $isOff
                    ? $this->daysOffContext($date, $byDate)
                    : ['days_off_before' => 0, 'days_off_after' => 0, 'anchor_off' => false];

                $dateRows[] = [
                    'id' => $meta['id'],
                    'label' => $meta['label'],
                    'short_label' => FederalHolidayCalendar::KEY_HOLIDAY_SHORT_LABELS[$meta['id']] ?? $meta['label'],
                    'off' => $isOff,
                    'days_off_before' => $dateContext['days_off_before'],
                    'days_off_after' => $dateContext['days_off_after'],
                    'sort_date' => $date,
                ];

                $total++;
                if ($isOff) {
                    $off++;
                }
            }

            usort($dateRows, fn (array $a, array $b): int => strcmp($a['sort_date'], $b['sort_date']));
            $dateRows = array_map(function (array $row): array {
                unset($row['sort_date']);

                return $row;
            }, $dateRows);

            $context = $anchorDate !== null
                ? $this->daysOffContext($anchorDate, $byDate)
                : ['days_off_before' => 0, 'days_off_after' => 0, 'anchor_off' => false];

            $keyHolidays[$group] = [
                'off' => $off,
                'total' => $total,
                'anchor_label' => $anchorLabel,
                'anchor_off' => $context['anchor_off'],
                'days_off_before' => $context['days_off_before'],
                'days_off_after' => $context['days_off_after'],
                'dates' => $dateRows,
            ];
        }

        $weekends = $this->countWeekendMetrics($days, $byDate);
        $septFebWeekends = $this->countWeekendMetrics(
            $days,
            $byDate,
            fn (CarbonImmutable $date): bool => $bidRange->isInSeptFebSeason($date),
        );

        return [
            'holidays_off' => $holidaysOff,
            'key_holidays' => $keyHolidays,
            'fri_off' => $weekends['fri_off'],
            'sat_off' => $weekends['sat_off'],
            'sun_off' => $weekends['sun_off'],
            'fri_sat_sun_all_off' => $weekends['fri_sat_sun_all_off'],
            'sat_sun_both_off' => $weekends['sat_sun_both_off'],
            'sept_feb' => $septFebWeekends,
        ];
    }

    /**
     * @param  array<string, bool>  $byDate
     * @return array{days_off_before: int, days_off_after: int, anchor_off: bool}
     */
    private function daysOffContext(string $anchorYmd, array $byDate, int $maxDays = 31): array
    {
        if (! array_key_exists($anchorYmd, $byDate) || $byDate[$anchorYmd] !== true) {
            return ['days_off_before' => 0, 'days_off_after' => 0, 'anchor_off' => false];
        }

        $anchor = CarbonImmutable::parse($anchorYmd)->startOfDay();
        $daysOffBefore = 0;
        for ($i = 1; $i <= $maxDays; $i++) {
            $ymd = $anchor->subDays($i)->format('Y-m-d');
            if (! array_key_exists($ymd, $byDate)) {
                break;
            }
            if ($byDate[$ymd] === true) {
                $daysOffBefore++;
            } else {
                break;
            }
        }

        $daysOffAfter = 0;
        for ($i = 1; $i <= $maxDays; $i++) {
            $ymd = $anchor->addDays($i)->format('Y-m-d');
            if (! array_key_exists($ymd, $byDate)) {
                break;
            }
            if ($byDate[$ymd] === true) {
                $daysOffAfter++;
            } else {
                break;
            }
        }

        return [
            'days_off_before' => $daysOffBefore,
            'days_off_after' => $daysOffAfter,
            'anchor_off' => true,
        ];
    }

    /**
     * @param  Collection<int, BidLineDay>  $days
     * @param  array<string, bool>  $byDate
     * @param  (callable(CarbonImmutable): bool)|null  $dateFilter
     * @return array{
     *   fri_off: int,
     *   sat_off: int,
     *   sun_off: int,
     *   fri_sat_sun_all_off: int,
     *   sat_sun_both_off: int,
     * }
     */
    private function countWeekendMetrics(Collection $days, array $byDate, ?callable $dateFilter = null): array
    {
        $friOff = 0;
        $satOff = 0;
        $sunOff = 0;
        $friSatSunBlocks = 0;
        $satSunPairs = 0;

        foreach ($days as $d) {
            $date = CarbonImmutable::parse($d->assignment_date)->startOfDay();
            if ($dateFilter !== null && ! $dateFilter($date)) {
                continue;
            }
            if ($d->is_off && $date->isFriday()) {
                $friOff++;
            }
            if ($d->is_off && $date->isSaturday()) {
                $satOff++;
            }
            if ($d->is_off && $date->isSunday()) {
                $sunOff++;
            }
        }

        foreach ($days as $d) {
            $friday = CarbonImmutable::parse($d->assignment_date)->startOfDay();
            if (! $friday->isFriday()) {
                continue;
            }
            if ($dateFilter !== null && ! $dateFilter($friday)) {
                continue;
            }
            $f = $friday->format('Y-m-d');
            $sa = $friday->addDay()->format('Y-m-d');
            $su = $friday->addDays(2)->format('Y-m-d');
            if (($byDate[$f] ?? false) && ($byDate[$sa] ?? false) && ($byDate[$su] ?? false)) {
                $friSatSunBlocks++;
            }
        }

        foreach ($days as $d) {
            $saturday = CarbonImmutable::parse($d->assignment_date)->startOfDay();
            if (! $saturday->isSaturday()) {
                continue;
            }
            if ($dateFilter !== null && ! $dateFilter($saturday)) {
                continue;
            }
            $sa = $saturday->format('Y-m-d');
            $su = $saturday->addDay()->format('Y-m-d');
            if (($byDate[$sa] ?? false) && ($byDate[$su] ?? false)) {
                $satSunPairs++;
            }
        }

        return [
            'fri_off' => $friOff,
            'sat_off' => $satOff,
            'sun_off' => $sunOff,
            'fri_sat_sun_all_off' => $friSatSunBlocks,
            'sat_sun_both_off' => $satSunPairs,
        ];
    }

    /**
     * @return Collection<int, BidLineDay>
     */
    private function orderedDays(BidLine $line): Collection
    {
        if ($line->relationLoaded('days')) {
            return $line->days->sortBy('assignment_date')->values();
        }

        return $line->days()->orderBy('assignment_date')->get();
    }
}
