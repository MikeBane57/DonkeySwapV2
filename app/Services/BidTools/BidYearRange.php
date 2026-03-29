<?php

namespace App\Services\BidTools;

use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class BidYearRange
{
    public function __construct(
        public readonly int $bidYear,
    ) {}

    public static function fromBidYear(int $bidYear): self
    {
        return new self($bidYear);
    }

    public function start(): CarbonImmutable
    {
        return CarbonImmutable::create($this->bidYear, 2, 1)->startOfDay();
    }

    public function end(): CarbonImmutable
    {
        return CarbonImmutable::create($this->bidYear + 1, 1, 31)->endOfDay();
    }

    /**
     * @return Collection<int, CarbonImmutable>
     */
    public function eachDate(): Collection
    {
        $dates = collect();
        $d = $this->start();
        $end = $this->end()->startOfDay();
        while ($d->lte($end)) {
            $dates->push($d);
            $d = $d->addDay();
        }

        return $dates;
    }

    public function containsDate(CarbonImmutable|string $date): bool
    {
        $d = $date instanceof CarbonImmutable
            ? $date->startOfDay()
            : CarbonImmutable::parse($date)->startOfDay();
        $start = $this->start();
        $end = $this->end()->startOfDay();

        return $d->gte($start) && $d->lte($end);
    }
}
