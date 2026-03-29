<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

final class BidLinePreferenceCatalog
{
    public function __construct(
        private DominantDeskAnalyzer $deskAnalyzer,
        private StartTimeNormalizer $startTimes,
    ) {}

    /**
     * Desk group buckets present in this import (for scenario UI + scoring keys).
     *
     * @return list<array{key: string, label: string}>
     */
    public function deskCatalogForImport(int $bidImportId): array
    {
        $groups = BidLine::query()
            ->where('bid_import_id', $bidImportId)
            ->distinct()
            ->orderBy('desk_group')
            ->pluck('desk_group');

        $byBucket = [];
        foreach ($groups as $g) {
            $g = trim((string) $g);
            if ($g === '') {
                continue;
            }
            $bucket = $this->deskAnalyzer->groupBucket($g);
            if (! array_key_exists($bucket, $byBucket)) {
                $byBucket[$bucket] = $g;
            }
        }

        ksort($byBucket, SORT_STRING);

        $out = [];
        foreach ($byBucket as $key => $representativeRaw) {
            $out[] = [
                'key' => $key,
                'label' => $this->deskBucketLabel($key, $representativeRaw),
            ];
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    public function deskKeysForImport(int $bidImportId): array
    {
        return array_column($this->deskCatalogForImport($bidImportId), 'key');
    }

    /**
     * Start-time rank keys present in this import.
     *
     * @return list<array{key: string, label: string}>
     */
    public function startTimeCatalogForImport(int $bidImportId): array
    {
        $times = BidLine::query()
            ->where('bid_import_id', $bidImportId)
            ->distinct()
            ->orderBy('start_time')
            ->pluck('start_time');

        $byKey = [];
        foreach ($times as $t) {
            $t = trim((string) $t);
            if ($t === '') {
                continue;
            }
            $key = $this->startTimes->rankKey($t);
            if (! array_key_exists($key, $byKey)) {
                $byKey[$key] = $this->startTimes->displayLabel($t);
            }
        }

        ksort($byKey, SORT_STRING);

        $out = [];
        foreach ($byKey as $key => $label) {
            $out[] = ['key' => $key, 'label' => $label];
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    public function startTimeKeysForImport(int $bidImportId): array
    {
        return array_column($this->startTimeCatalogForImport($bidImportId), 'key');
    }

    private function deskBucketLabel(string $bucket, string $representativeRaw): string
    {
        return match ($bucket) {
            'mix' => 'Mixed / multi-desk',
            'mg_ms' => 'MG / MS family',
            'unknown' => 'Unknown',
            default => strtoupper(trim($representativeRaw)),
        };
    }
}
