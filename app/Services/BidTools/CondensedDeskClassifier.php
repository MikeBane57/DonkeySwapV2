<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

/**
 * Maps bid lines to desk preference buckets using desk group codes.
 *
 * AM: DS, DG, DS7 (DS @ 0700), DR, DS/DR Mix
 * PM: AS, AG, AS15 (AS @ 1500), AR, AS/AR Mix
 * Mid: MS, MG, MG/MS
 * Relief: relief work on the line
 */
final class CondensedDeskClassifier
{
    /** @var list<string> */
    public const BUCKETS = [
        'DS',
        'DG',
        'DS7',
        'DR',
        'DS_DR_MIX',
        'AG',
        'AS',
        'AS15',
        'AR',
        'AS_AR_MIX',
        'MID',
        'RELIEF',
    ];

    /** @var array<string, string> */
    public const LABELS = [
        'DS' => 'DS',
        'DG' => 'DG',
        'DS7' => 'DS7',
        'DR' => 'DR',
        'DS_DR_MIX' => 'DS/DR Mix',
        'AG' => 'AG',
        'AS' => 'AS',
        'AS15' => 'AS15',
        'AR' => 'AR',
        'AS_AR_MIX' => 'AS/AR Mix',
        'MID' => 'Mid',
        'RELIEF' => 'Relief',
    ];

    /** @var array<string, string> */
    public const LEGACY_BUCKET_MAP = [
        'DG7' => 'DG',
        'AG15' => 'AG',
        'DR7' => 'DR',
        'AR15' => 'AR',
        'DS7' => 'DS7',
        'AS7' => 'AS15',
    ];

    public function __construct(
        private readonly StartTimeNormalizer $startTimes,
    ) {}

    public function bucketForLine(BidLine $line): string
    {
        $line->loadMissing('days');

        if ($this->hasReliefWork($line)) {
            return 'RELIEF';
        }

        $group = strtoupper(trim($line->desk_group));
        $startKey = $this->startTimes->rankKey($line->start_time);

        if ($this->isDsDrMixGroup($group)) {
            return 'DS_DR_MIX';
        }

        if ($this->isAsArMixGroup($group)) {
            return 'AS_AR_MIX';
        }

        if ($this->isMidDeskGroup($group)) {
            return 'MID';
        }

        $fromGroup = $this->bucketFromDeskType($group, $startKey);
        if ($fromGroup !== null) {
            return $fromGroup;
        }

        $fromWork = $this->bucketFromDominantWorkCode($line, $startKey);
        if ($fromWork !== null) {
            return $fromWork;
        }

        return 'unknown';
    }

    public function normalizeBucketKey(string $bucket): string
    {
        $upper = strtoupper(trim($bucket));

        return self::LEGACY_BUCKET_MAP[$upper] ?? $upper;
    }

    public function labelForBucket(string $bucket): string
    {
        $key = $this->normalizeBucketKey($bucket);

        return self::LABELS[$key] ?? $bucket;
    }

    public function startTimeTiebreakKey(BidLine $line): string
    {
        $startKey = $this->startTimes->rankKey($line->start_time);

        if (preg_match('/^t_(\d{2,4})$/', $startKey, $m)) {
            $digits = $m[1];
            $hour = strlen($digits) === 4
                ? (int) substr($digits, 0, 2)
                : (int) $digits;

            return match ($hour) {
                6 => '6',
                7 => '7',
                14 => '14',
                15 => '15',
                22 => '22',
                default => 'other',
            };
        }

        if (str_starts_with($startKey, 'am_mix') || $startKey === 'am') {
            return '6';
        }

        if ($startKey === 'pm_mix' || $startKey === 'pm') {
            return '15';
        }

        if ($startKey === 'mid_mix' || $startKey === 'mid') {
            return '22';
        }

        return 'other';
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
     * @return list<array{key: string, label: string}>
     */
    public function deskCatalogForImport(int $bidImportId): array
    {
        return array_map(
            fn (string $key) => ['key' => $key, 'label' => $this->labelForBucket($key)],
            $this->bucketsPresentInImport($bidImportId),
        );
    }

    /**
     * @return array{
     *   id: int,
     *   line_num: string,
     *   desk_group: string,
     *   start_time: string,
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
            $key = $this->normalizeBucketKey((string) $entry['key']);
            if (in_array($key, self::BUCKETS, true)) {
                return true;
            }
        }

        return false;
    }

    private function bucketFromDeskType(string $group, string $startKey): ?string
    {
        if ($group === '') {
            return null;
        }

        if ($this->deskTypeMatches($group, 'DG')) {
            return 'DG';
        }

        if ($this->deskTypeMatches($group, 'DR')) {
            return 'DR';
        }

        if ($this->deskTypeMatches($group, 'DS')) {
            return $this->startsAtHour($startKey, 7) ? 'DS7' : 'DS';
        }

        if ($this->deskTypeMatches($group, 'AG')) {
            return 'AG';
        }

        if ($this->deskTypeMatches($group, 'AR')) {
            return 'AR';
        }

        if ($this->deskTypeMatches($group, 'AS')) {
            return $this->startsAtHour($startKey, 15) ? 'AS15' : 'AS';
        }

        return null;
    }

    private function bucketFromDominantWorkCode(BidLine $line, string $startKey): ?string
    {
        $code = $this->dominantWorkCode($line);
        if ($code === null || $code === '') {
            return null;
        }

        return $this->bucketFromDeskType($code, $startKey);
    }

    private function dominantWorkCode(BidLine $line): ?string
    {
        $freq = [];
        foreach ($line->days as $day) {
            if ($day->is_off || $day->normalized_code === null) {
                continue;
            }
            $code = strtoupper(trim($day->normalized_code));
            if ($code === '') {
                continue;
            }
            $freq[$code] = ($freq[$code] ?? 0) + 1;
        }

        if ($freq === []) {
            return null;
        }

        arsort($freq);

        return array_key_first($freq);
    }

    private function deskTypeMatches(string $group, string $type): bool
    {
        if ($group === $type) {
            return true;
        }

        return (bool) preg_match('/^'.preg_quote($type, '/').'(\b|\/)/', $group);
    }

    private function startsAtHour(string $startKey, int $hour): bool
    {
        return $this->hourFromStartKey($startKey) === $hour;
    }

    private function hourFromStartKey(string $startKey): ?int
    {
        if (preg_match('/^t_(\d{2,4})$/', $startKey, $m)) {
            $digits = $m[1];

            return strlen($digits) === 4
                ? (int) substr($digits, 0, 2)
                : (int) $digits;
        }

        return null;
    }

    private function hasReliefWork(BidLine $line): bool
    {
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

    private function isMidDeskGroup(string $group): bool
    {
        if ($group === '') {
            return false;
        }

        if (preg_match('/^(MS|MG)\b/', $group)) {
            return true;
        }

        if (preg_match('/MG\/MS|MS\/MG/', $group)) {
            return true;
        }

        return str_contains($group, 'MID') && str_contains($group, 'MIX');
    }

    private function isDsDrMixGroup(string $group): bool
    {
        if ($group === '') {
            return false;
        }

        if (preg_match('/DS.*DR|DR.*DS/', $group)) {
            return true;
        }

        if (str_contains($group, 'MIX') && ! str_contains($group, 'MID')) {
            return str_contains($group, 'DS') && str_contains($group, 'DR');
        }

        return false;
    }

    private function isAsArMixGroup(string $group): bool
    {
        if ($group === '') {
            return false;
        }

        if (preg_match('/AS.*AR|AR.*AS/', $group)) {
            return true;
        }

        if (str_contains($group, 'MIX') && ! str_contains($group, 'MID')) {
            return str_contains($group, 'AS') && str_contains($group, 'AR');
        }

        return false;
    }
}
