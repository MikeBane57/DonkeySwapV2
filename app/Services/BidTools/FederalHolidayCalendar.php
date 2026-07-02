<?php

namespace App\Services\BidTools;

use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * US federal-style dates as calendar dates (not observed).
 */
final class FederalHolidayCalendar
{
    /**
     * Default holiday preference order for new scenarios.
     * Earlier IDs rank higher; all listed IDs use high priority.
     *
     * @var list<string>
     */
    public const DEFAULT_RANKED_HOLIDAY_IDS = [
        'christmas_eve',
        'christmas_day',
        'thanksgiving',
        'black_friday',
        'july_4',
        'super_bowl_sunday',
    ];

    public static function defaultHolidayPriority(string $id): string
    {
        return in_array($id, self::DEFAULT_RANKED_HOLIDAY_IDS, true) ? 'high' : 'ignore';
    }

    /**
     * @return Collection<string, array{id: string, label: string}> keyed by Y-m-d
     */
    public function holidaysInBidYear(int $bidYear): Collection
    {
        $range = BidYearRange::fromBidYear($bidYear);
        $out = collect();

        foreach ([$bidYear, $bidYear + 1] as $y) {
            $candidates = [
                [CarbonImmutable::create($y, 12, 31), 'new_years_eve', "New Year's Eve"],
                [CarbonImmutable::create($y, 1, 1), 'new_years_day', "New Year's Day"],
                [$this->nthSundayOfMonth($y, 2, 2), 'super_bowl_sunday', 'Super Bowl Sunday'],
                [$this->easterSunday($y), 'easter', 'Easter'],
                [$this->nthSundayOfMonth($y, 5, 2), 'mothers_day', "Mother's Day"],
                [$this->nthSundayOfMonth($y, 6, 3), 'fathers_day', "Father's Day"],
                [$this->lastMondayOfMonth($y, 5), 'memorial_day', 'Memorial Day'],
                [CarbonImmutable::create($y, 7, 4), 'july_4', 'July 4'],
                [$this->firstMondayOfMonth($y, 9), 'labor_day', 'Labor Day'],
                [$this->nthThursdayOfMonth($y, 11, 4), 'thanksgiving', 'Thanksgiving'],
                [$this->nthThursdayOfMonth($y, 11, 4)->addDay(), 'black_friday', 'Black Friday'],
                [CarbonImmutable::create($y, 12, 24), 'christmas_eve', 'Christmas Eve'],
                [CarbonImmutable::create($y, 12, 25), 'christmas_day', 'Christmas Day'],
            ];

            foreach ($candidates as [$date, $id, $label]) {
                if ($range->containsDate($date)) {
                    $out[$date->format('Y-m-d')] = ['id' => $id, 'label' => $label];
                }
            }
        }

        return $out;
    }

    private function nthSundayOfMonth(int $year, int $month, int $n): CarbonImmutable
    {
        $d = CarbonImmutable::create($year, $month, 1)->startOfDay();
        $count = 0;
        while ($d->month === $month) {
            if ($d->isSunday()) {
                $count++;
                if ($count === $n) {
                    return $d;
                }
            }
            $d = $d->addDay();
        }

        return CarbonImmutable::create($year, $month, 1);
    }

    private function firstMondayOfMonth(int $year, int $month): CarbonImmutable
    {
        $d = CarbonImmutable::create($year, $month, 1)->startOfDay();
        while ($d->month === $month) {
            if ($d->isMonday()) {
                return $d;
            }
            $d = $d->addDay();
        }

        return CarbonImmutable::create($year, $month, 1);
    }

    private function lastMondayOfMonth(int $year, int $month): CarbonImmutable
    {
        $d = CarbonImmutable::create($year, $month, 1)->endOfMonth()->startOfDay();
        while ($d->month === $month) {
            if ($d->isMonday()) {
                return $d;
            }
            $d = $d->subDay();
        }

        return CarbonImmutable::create($year, $month, 1);
    }

    private function nthThursdayOfMonth(int $year, int $month, int $n): CarbonImmutable
    {
        $d = CarbonImmutable::create($year, $month, 1)->startOfDay();
        $count = 0;
        while ($d->month === $month) {
            if ($d->isThursday()) {
                $count++;
                if ($count === $n) {
                    return $d;
                }
            }
            $d = $d->addDay();
        }

        return CarbonImmutable::create($year, $month, 1);
    }

    /**
     * Anonymous Gregorian algorithm.
     */
    private function easterSunday(int $year): CarbonImmutable
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;

        return CarbonImmutable::create($year, $month, $day)->startOfDay();
    }
}
