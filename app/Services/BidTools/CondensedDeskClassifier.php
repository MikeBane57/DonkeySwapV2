<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

/**
 * Maps bid-line desk codes and mix start times to condensed preference buckets.
 *
 * XG  — regional (AG, DG)
 * XR  — router (AR, DR) plus AM/PM mixed lines
 * XS  — sectors (AS, DS)
 * MID — midnight (MS, MG) plus midnight mixed lines
 * RELIEF — relief assignments
 */
final class CondensedDeskClassifier
{
    /** @var list<string> */
    public const BUCKETS = ['XG', 'XR', 'XS', 'MID', 'RELIEF'];

    public function __construct(
        private readonly StartTimeNormalizer $startTimes,
        private readonly LineShiftClassifier $lineShift,
    ) {}

    public function bucketForLine(BidLine $line): string
    {
        $line->loadMissing('days');

        $mixBucket = $this->bucketForStartTimeMix($line->start_time);
        if ($mixBucket !== null) {
            return $mixBucket;
        }

        $group = strtoupper(trim($line->desk_group));
        if ($group !== '' && (str_contains($group, 'MIX') || str_contains($group, '/'))) {
            return str_contains($group, 'MID') ? 'MID' : 'XR';
        }

        $freq = [];
        $reliefCount = 0;
        foreach ($line->days as $day) {
            if ($day->is_off || $day->normalized_code === null) {
                continue;
            }

            $code = strtoupper(trim($day->normalized_code));
            if ($code === '') {
                continue;
            }

            if (str_contains($code, 'RELIEF')) {
                $reliefCount++;

                continue;
            }

            $bucket = $this->bucketForNormalizedCode($code);
            if ($bucket !== null) {
                $freq[$bucket] = ($freq[$bucket] ?? 0) + 1;
            }
        }

        if ($freq !== []) {
            arsort($freq);

            return (string) array_key_first($freq);
        }

        if ($reliefCount > 0) {
            return 'RELIEF';
        }

        $fromGroup = $this->bucketForNormalizedCode($group);
        if ($fromGroup !== null) {
            return $fromGroup;
        }

        return 'unknown';
    }

    public function bucketForNormalizedCode(string $code): ?string
    {
        $code = strtoupper(trim($code));
        if ($code === '') {
            return null;
        }

        if (str_contains($code, 'RELIEF')) {
            return 'RELIEF';
        }

        if (preg_match('/^(AG|DG)/', $code)) {
            return 'XG';
        }

        if (preg_match('/^(AR|DR)/', $code)) {
            return 'XR';
        }

        if (preg_match('/^(AS|DS)/', $code)) {
            return 'XS';
        }

        if (preg_match('/^(MS|MG)/', $code)) {
            return 'MID';
        }

        return null;
    }

    public function bucketForStartTimeMix(string $startTime): ?string
    {
        $key = $this->startTimes->rankKey($startTime);

        if (str_starts_with($key, 'am_mix') || $key === 'pm_mix') {
            return 'XR';
        }

        if ($key === 'mid_mix') {
            return 'MID';
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public function bucketsPresentInImport(int $bidImportId): array
    {
        $seen = [];
        BidLine::query()
            ->where('bid_import_id', $bidImportId)
            ->select(['id', 'desk_group', 'start_time'])
            ->chunkById(200, function ($lines) use (&$seen) {
                foreach ($lines as $line) {
                    $bucket = $this->bucketForLine($line);
                    if ($bucket !== 'unknown') {
                        $seen[$bucket] = true;
                    }
                }
            });

        $ordered = array_values(array_filter(
            self::BUCKETS,
            fn (string $bucket) => isset($seen[$bucket]),
        ));

        return $ordered !== [] ? $ordered : self::BUCKETS;
    }

    /**
     * AM, PM, or midnight shift bucket for line-picker filters.
     */
    public function startShiftBucket(string $startTime): string
    {
        return $this->lineShift->startShiftBucket($startTime);
    }

    /**
     * @return array{
     *   id: int,
     *   line_num: string,
     *   desk_group: string,
     *   start_time: string,
     *   desk_shift: string|null,
     *   desk_bucket: string,
     * }
     */
    public function linePickerFields(BidLine $line): array
    {
        return [
            'id' => $line->id,
            'line_num' => $line->line_num,
            'desk_group' => $line->desk_group,
            'start_time' => $line->start_time,
            'desk_shift' => $this->lineShift->classify($line),
            'desk_bucket' => $this->bucketForLine($line),
        ];
    }

    /**
     * @param  list<array{key: string, priority?: string}>  $deskEntries
     */
    public function usesCondensedBuckets(array $deskEntries): bool
    {
        foreach ($deskEntries as $entry) {
            if (! is_array($entry) || empty($entry['key'])) {
                continue;
            }
            if (in_array(strtoupper((string) $entry['key']), self::BUCKETS, true)) {
                return true;
            }
        }

        return false;
    }
}
