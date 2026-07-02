<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenario;
use Carbon\CarbonImmutable;

final class VacationCostCalculator
{
    /**
     * Workdays (non-off) inside personal date ranges for this line.
     */
    public function totalCost(BidScenario $scenario, BidLine $line): int
    {
        $line->loadMissing('days');

        $byDate = [];
        foreach ($line->days as $d) {
            $byDate[$d->assignment_date->format('Y-m-d')] = $d->is_off;
        }

        $cost = 0;
        foreach ($this->rangeEntries($scenario->personal_dates ?? []) as $range) {
            $start = CarbonImmutable::parse($range['starts_on'])->startOfDay();
            $end = CarbonImmutable::parse($range['ends_on'])->startOfDay();
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

    /**
     * @return list<array{starts_on: string, ends_on: string}>
     */
    private function rangeEntries(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }

            $startsOn = (string) ($row['starts_on'] ?? '');
            $endsOn = (string) ($row['ends_on'] ?? '');
            if ($startsOn !== '' && $endsOn !== '') {
                $out[] = ['starts_on' => $startsOn, 'ends_on' => $endsOn];
            }
        }

        return $out;
    }
}
