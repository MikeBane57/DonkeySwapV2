<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

/**
 * Unified AM / PM / Mid / Relief line classification for picker filters and strict shift ordering.
 *
 * Relief overrides start time. Non-relief lines use clock start (06/07 = AM, 14/15 = PM, 22 = Mid).
 */
final class LineShiftClassifier
{
    public const SHIFT_AM = 'am';

    public const SHIFT_PM = 'pm';

    public const SHIFT_MID = 'mid';

    public const SHIFT_RELIEF = 'relief';

    public const SHIFT_OTHER = 'other';

    /** @var list<string> */
    public const STRICT_ORDER = [
        self::SHIFT_AM,
        self::SHIFT_PM,
        self::SHIFT_MID,
        self::SHIFT_RELIEF,
        self::SHIFT_OTHER,
    ];

    public function __construct(
        private readonly StartTimeNormalizer $startTimes,
    ) {}

    public function classify(BidLine $line): string
    {
        if ($this->isReliefLine($line)) {
            return self::SHIFT_RELIEF;
        }

        $bucket = $this->startShiftBucket($line->start_time);

        return in_array($bucket, [self::SHIFT_AM, self::SHIFT_PM, self::SHIFT_MID], true)
            ? $bucket
            : self::SHIFT_OTHER;
    }

    public function startShiftBucket(string $startTime): string
    {
        $key = $this->startTimes->rankKey($startTime);

        if ($key === self::SHIFT_AM || str_starts_with($key, 'am_mix') || preg_match('/^t_0[67]/', $key)) {
            return self::SHIFT_AM;
        }

        if ($key === self::SHIFT_PM || $key === 'pm_mix' || preg_match('/^t_1[45]/', $key)) {
            return self::SHIFT_PM;
        }

        if ($key === self::SHIFT_MID || $key === 'mid_mix' || preg_match('/^t_22/', $key)) {
            return self::SHIFT_MID;
        }

        return self::SHIFT_OTHER;
    }

    public function sortRank(string $shift): int
    {
        $index = array_search($shift, self::STRICT_ORDER, true);

        return $index === false ? count(self::STRICT_ORDER) : $index;
    }

    public static function label(string $shift): string
    {
        return match ($shift) {
            self::SHIFT_AM => 'AM',
            self::SHIFT_PM => 'PM',
            self::SHIFT_MID => 'Mid',
            self::SHIFT_RELIEF => 'Relief',
            default => 'Other',
        };
    }

    private function isReliefLine(BidLine $line): bool
    {
        $line->loadMissing('days');

        foreach ($line->days as $day) {
            if ($day->is_off || $day->normalized_code === null) {
                continue;
            }

            $code = strtoupper(trim($day->normalized_code));
            if ($code !== '' && str_contains($code, 'RELIEF')) {
                return true;
            }
        }

        return false;
    }
}
