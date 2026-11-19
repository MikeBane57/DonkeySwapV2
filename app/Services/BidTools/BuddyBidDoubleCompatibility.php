<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

/**
 * Whether two bid lines can form a legal buddy double (≤ 30 minutes shift overlap).
 */
final class BuddyBidDoubleCompatibility
{
    public function __construct(
        private readonly WorkShiftRules $workShifts,
    ) {}

    public function linesCanDouble(BidLine $lineA, BidLine $lineB): bool
    {
        $startsA = $this->workShifts->lineStartCandidates($lineA);
        $startsB = $this->workShifts->lineStartCandidates($lineB);

        if ($startsA === [] || $startsB === []) {
            return false;
        }

        foreach ($startsA as $startA) {
            $durationA = $this->durationForStart($startA);
            foreach ($startsB as $startB) {
                $durationB = $this->durationForStart($startB);
                if ($this->workShifts->shiftsCanBuddyDouble(
                    $startA,
                    $durationA,
                    $startB,
                    $durationB,
                )) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Short label for UI when lines can double (legacy am_pm still when obvious).
     */
    public function pairingLabel(BidLine $lineA, BidLine $lineB): ?string
    {
        if (! $this->linesCanDouble($lineA, $lineB)) {
            return null;
        }

        $startsA = $this->workShifts->lineStartCandidates($lineA);
        $startsB = $this->workShifts->lineStartCandidates($lineB);
        sort($startsA);
        sort($startsB);

        return 'ok ('.implode('/', $startsA).' + '.implode('/', $startsB).')';
    }

    /**
     * @deprecated Use pairingLabel() with BidLine models; kept for callers passing buckets.
     */
    public function shiftBucketForLine(BidLine $line): string
    {
        $start = $this->workShifts->lineStartCandidates($line)[0]
            ?? $this->workShifts->normalizeHhmm($line->start_time)
            ?? '';

        return match (true) {
            $start === '2200' => 'mid',
            $this->workShifts->hhmmToMinutes($start) < $this->workShifts->hhmmToMinutes('1200') => 'am',
            default => 'pm',
        };
    }

    /**
     * @deprecated Overlap-based pairing replaces fixed bucket pairs.
     */
    public function pairingType(string $bucketA, string $bucketB): ?string
    {
        if ($bucketA === $bucketB) {
            return null;
        }

        $pair = [$bucketA, $bucketB];
        sort($pair);

        return match (implode('_', $pair)) {
            'am_pm' => 'am_pm',
            'mid_pm' => 'pm_mid',
            'am_mid' => 'mid_am',
            default => null,
        };
    }

    private function durationForStart(string $start): int
    {
        if ($start === '2200') {
            return WorkShiftRules::WORK_MINUTES_MID;
        }

        return WorkShiftRules::WORK_MINUTES_STANDARD;
    }
}
