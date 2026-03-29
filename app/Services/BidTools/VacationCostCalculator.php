<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenario;
use Carbon\CarbonImmutable;

final class VacationCostCalculator
{
    /**
     * Workdays (non-off) inside vacation ranges for this line.
     */
    public function totalCost(BidScenario $scenario, BidLine $line): int
    {
        $scenario->loadMissing('vacationRanges');
        $line->loadMissing('days');

        $byDate = [];
        foreach ($line->days as $d) {
            $byDate[$d->assignment_date->format('Y-m-d')] = $d->is_off;
        }

        $cost = 0;
        foreach ($scenario->vacationRanges as $range) {
            $start = CarbonImmutable::parse($range->starts_on)->startOfDay();
            $end = CarbonImmutable::parse($range->ends_on)->startOfDay();
            $d = $start;
            while ($d->lte($end)) {
                $ymd = $d->format('Y-m-d');
                if (($byDate[$ymd] ?? true) === false) {
                    $cost++;
                }
                $d = $d->addDay();
            }
        }

        return $cost;
    }
}
