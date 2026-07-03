<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use Illuminate\Support\Collection;

/**
 * Maps bid lines to desk preference buckets using desk group codes.
 *
 * AM: DS, DG, DS7 (DS @ 0700), DR, DS/DR Mix
 * PM: AS, AG, AS15 (AS @ 1500), AR, AS/AR Mix
 * Mid: MS, MG, MG/MS
 * Relief: RELIEF desk group or relief work on the line
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

    /** @var array<string, list<string>> */
    private array $bucketsPresentCache = [];

    public function bucketForLine(BidLine $line, array $mappings = [], array $lineBuckets = []): string
    {
        $normalizedLineBuckets = $this->normalizeLineBuckets($lineBuckets);
        if (isset($normalizedLineBuckets[$line->id])) {
            return $normalizedLineBuckets[$line->id];
        }

        $normalizedMappings = $this->normalizeMappings($mappings);
        $mapped = $this->resolveMappedBucket($line, $normalizedMappings);
        if ($mapped !== null) {
            return $mapped;
        }

        return $this->autoBucketForLine($line);
    }

    public function autoBucketForLine(BidLine $line): string
    {
        $line->loadMissing('days');

        $group = strtoupper(trim($line->desk_group));

        if ($this->hasReliefWork($line) || $this->isReliefDeskGroup($group)) {
            return 'RELIEF';
        }

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

    /**
     * @param  list<array{desk_group: string, start_time: string|null, bucket: string}>  $mappings
     */
    public function resolveMappedBucket(BidLine $line, array $mappings): ?string
    {
        if ($mappings === []) {
            return null;
        }

        $group = trim($line->desk_group);
        $startKey = $this->startTimes->rankKey($line->start_time);

        foreach ($mappings as $mapping) {
            if (strcasecmp(trim($mapping['desk_group']), $group) !== 0) {
                continue;
            }

            $mappingStart = $mapping['start_time'];
            if ($mappingStart !== null && $mappingStart !== '') {
                if (! $this->startTimes->matchesStartTime($line->start_time, $mappingStart)) {
                    continue;
                }

                return $this->normalizeBucketKey($mapping['bucket']);
            }
        }

        foreach ($mappings as $mapping) {
            if (strcasecmp(trim($mapping['desk_group']), $group) !== 0) {
                continue;
            }

            if ($mapping['start_time'] === null || $mapping['start_time'] === '') {
                return $this->normalizeBucketKey($mapping['bucket']);
            }
        }

        return null;
    }

    /**
     * @return list<array{desk_group: string, start_time: string|null, bucket: string}>
     */
    public function normalizeMappings(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $group = trim((string) ($entry['desk_group'] ?? ''));
            $bucket = $this->normalizeBucketKey((string) ($entry['bucket'] ?? ''));
            if ($group === '' || $bucket === '') {
                continue;
            }

            if ($bucket !== 'unknown' && ! in_array($bucket, self::BUCKETS, true)) {
                continue;
            }

            $startTime = $entry['start_time'] ?? null;
            if ($startTime !== null && $startTime !== '') {
                $startTime = trim((string) $startTime);
            } else {
                $startTime = null;
            }

            $out[] = [
                'desk_group' => $group,
                'start_time' => $startTime,
                'bucket' => $bucket,
            ];
        }

        return $out;
    }

    /**
     * @return array<int, string>
     */
    public function normalizeLineBuckets(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $key => $entry) {
            if (is_array($entry)) {
                $lineId = (int) ($entry['bid_line_id'] ?? $entry['line_id'] ?? 0);
                $bucket = $this->normalizeBucketKey((string) ($entry['bucket'] ?? ''));
            } else {
                $lineId = (int) $key;
                $bucket = $this->normalizeBucketKey((string) $entry);
            }

            if ($lineId <= 0 || $bucket === '') {
                continue;
            }

            if ($bucket !== 'unknown' && ! in_array($bucket, self::BUCKETS, true)) {
                continue;
            }

            $out[$lineId] = $bucket;
        }

        return $out;
    }

    /**
     * @param  array<int, string>  $lineBuckets
     * @return list<array{bid_line_id: int, bucket: string}>
     */
    public function lineBucketsForStorage(array $lineBuckets): array
    {
        $out = [];
        foreach ($lineBuckets as $lineId => $bucket) {
            $lineId = (int) $lineId;
            $bucket = $this->normalizeBucketKey($bucket);
            if ($lineId <= 0 || $bucket === '') {
                continue;
            }

            $out[] = [
                'bid_line_id' => $lineId,
                'bucket' => $bucket,
            ];
        }

        usort($out, fn (array $a, array $b): int => $a['bid_line_id'] <=> $b['bid_line_id']);

        return $out;
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
     * @param  list<array{desk_group: string, start_time: string|null, bucket: string}>  $mappings
     * @param  array<int, string>  $lineBuckets
     * @param  Collection<int, BidLine>|null  $lines
     * @return list<string>
     */
    public function bucketsPresentInImport(
        int $bidImportId,
        array $mappings = [],
        array $lineBuckets = [],
        ?Collection $lines = null,
    ): array {
        $normalizedMappings = $this->normalizeMappings($mappings);
        $normalizedLineBuckets = $this->normalizeLineBuckets($lineBuckets);
        $cacheKey = $bidImportId.':'.md5(json_encode([$normalizedMappings, $normalizedLineBuckets]));

        if ($lines === null && isset($this->bucketsPresentCache[$cacheKey])) {
            return $this->bucketsPresentCache[$cacheKey];
        }

        $seen = [];
        $collectBuckets = function (iterable $lineSet) use (&$seen, $normalizedMappings, $normalizedLineBuckets): void {
            foreach ($lineSet as $line) {
                $bucket = $this->bucketForLine($line, $normalizedMappings, $normalizedLineBuckets);
                if ($bucket !== 'unknown') {
                    $seen[$bucket] = true;
                }
            }
        };

        if ($lines !== null) {
            $collectBuckets($lines);
        } else {
            BidLine::query()
                ->where('bid_import_id', $bidImportId)
                ->with('days')
                ->select(['id', 'desk_group', 'start_time', 'bid_import_id'])
                ->chunkById(200, function ($chunk) use ($collectBuckets): void {
                    $collectBuckets($chunk);
                });
        }

        $ordered = array_values(array_filter(
            self::BUCKETS,
            fn (string $bucket) => isset($seen[$bucket]),
        ));

        $result = $ordered !== [] ? $ordered : self::BUCKETS;

        if ($lines === null) {
            $this->bucketsPresentCache[$cacheKey] = $result;
        }

        return $result;
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    public function deskCatalogForImport(int $bidImportId): array
    {
        return array_map(
            fn (string $key) => ['key' => $key, 'label' => $this->labelForBucket($key)],
            self::BUCKETS,
        );
    }

    /**
     * @return array{
     *   id: int,
     *   line_num: string,
     *   desk_group: string,
     *   start_time: string,
     *   auto_desk_bucket: string,
     *   desk_bucket: string,
     *   is_manual_desk_bucket: bool,
     * }
     */
    public function linePickerFields(BidLine $line, array $mappings = [], array $lineBuckets = []): array
    {
        $normalizedLineBuckets = $this->normalizeLineBuckets($lineBuckets);

        return [
            'id' => $line->id,
            'line_num' => $line->line_num,
            'desk_group' => $line->desk_group,
            'start_time' => $line->start_time,
            'auto_desk_bucket' => $this->autoBucketForLine($line),
            'desk_bucket' => $this->bucketForLine($line, $mappings, $lineBuckets),
            'is_manual_desk_bucket' => isset($normalizedLineBuckets[$line->id]),
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

    private function isReliefDeskGroup(string $group): bool
    {
        if ($group === '') {
            return false;
        }

        return $this->deskTypeMatches($group, 'RELIEF') || str_contains($group, 'RELIEF');
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

        if ($group === 'MS' || $group === 'MG') {
            return true;
        }

        if (preg_match('/MG\/MS|MS\/MG/', $group)) {
            return true;
        }

        return preg_match('/\bMID\b/', $group) === 1 && str_contains($group, 'MIX');
    }

    /**
     * How desk groups in an import map to preference buckets (for debugging / review).
     *
     * @return list<array{
     *   desk_group: string,
     *   start_time: string,
     *   auto_bucket: string,
     *   desk_bucket: string,
     *   is_manual: bool,
     *   line_count: int,
     *   sample_line_num: string,
     * }>
     */
    public function bucketReferenceForImport(int $bidImportId, array $mappings = []): array
    {
        $normalizedMappings = $this->normalizeMappings($mappings);
        $rows = [];

        BidLine::query()
            ->where('bid_import_id', $bidImportId)
            ->with('days')
            ->orderBy('line_num')
            ->chunkById(200, function ($lines) use (&$rows, $normalizedMappings) {
                foreach ($lines as $line) {
                    $group = trim($line->desk_group);
                    $startTime = trim($line->start_time);
                    $startKey = $this->startTimes->rankKey($startTime);
                    $key = $group."\0".$startKey;

                    $autoBucket = $this->autoBucketForLine($line);
                    $effectiveBucket = $this->bucketForLine($line, $normalizedMappings);

                    if (! isset($rows[$key])) {
                        $rows[$key] = [
                            'desk_group' => $group,
                            'start_time' => $startTime,
                            'auto_bucket' => $autoBucket,
                            'desk_bucket' => $effectiveBucket,
                            'is_manual' => $this->resolveMappedBucket($line, $normalizedMappings) !== null,
                            'line_count' => 0,
                            'sample_line_num' => $line->line_num,
                        ];
                    }

                    $rows[$key]['line_count']++;
                    if ($autoBucket !== $effectiveBucket) {
                        $rows[$key]['is_manual'] = true;
                    }
                }
            });

        return collect($rows)
            ->sortBy([
                ['desk_group', 'asc'],
                ['start_time', 'asc'],
            ])
            ->values()
            ->all();
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
