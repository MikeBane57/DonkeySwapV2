<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

/**
 * Determines whether two shift buckets can form a legal buddy double.
 */
final class BuddyBidDoubleCompatibility
{
    public function __construct(
        private readonly LineShiftClassifier $shiftClassifier,
    ) {}

    public function shiftBucketForLine(BidLine $line): string
    {
        return $this->shiftClassifier->startShiftBucket((string) $line->start_time);
    }

    /**
     * @return 'am_pm'|'pm_mid'|'mid_am'|null
     */
    public function pairingType(string $bucketA, string $bucketB): ?string
    {
        if ($bucketA === $bucketB) {
            return null;
        }

        if ($bucketA === LineShiftClassifier::SHIFT_OTHER
            || $bucketB === LineShiftClassifier::SHIFT_OTHER
            || $bucketA === LineShiftClassifier::SHIFT_RELIEF
            || $bucketB === LineShiftClassifier::SHIFT_RELIEF) {
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

    public function linesCanDouble(BidLine $lineA, BidLine $lineB): bool
    {
        return $this->pairingType(
            $this->shiftBucketForLine($lineA),
            $this->shiftBucketForLine($lineB),
        ) !== null;
    }
}
