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
     *   key_holidays: array<string, array{off: int, total: int}>,
     *   fri_off: int,
     *   sat_off: int,
     *   sun_off: int,
     *   fri_sat_sun_all_off: int,
     *   sat_sun_both_off: int,
     * }
     */
    public function analyze(BidLine $line): array
    {
        $line->loadMissing('import');
        $bidYear = (int) $line->import->bid_year;
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
            foreach ($holidayCatalog as $date => $meta) {
                if (! in_array($meta['id'], $ids, true)) {
                    continue;
                }
                $total++;
                if (($byDate[$date] ?? false) === true) {
                    $off++;
                }
            }
            $keyHolidays[$group] = ['off' => $off, 'total' => $total];
        }

        $friOff = 0;
        $satOff = 0;
        $sunOff = 0;
        $friSatSunBlocks = 0;
        $satSunPairs = 0;

        foreach ($days as $d) {
            $date = CarbonImmutable::parse($d->assignment_date)->startOfDay();
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
            $sa = $saturday->format('Y-m-d');
            $su = $saturday->addDay()->format('Y-m-d');
            if (($byDate[$sa] ?? false) && ($byDate[$su] ?? false)) {
                $satSunPairs++;
            }
        }

        return [
            'holidays_off' => $holidaysOff,
            'key_holidays' => $keyHolidays,
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
