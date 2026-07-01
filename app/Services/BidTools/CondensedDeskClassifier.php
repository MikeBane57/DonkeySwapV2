<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

/**
 * Maps bid lines to desk preference buckets (desk family + start shift).
 *
 * DG7  — regional 06/07
 * AG15 — regional 14/15
 * DR7  — router 06/07 (non-mixed)
 * AR15 — router 14/15 (non-mixed)
 * DS7  — sector 06/07, DS/DR mixed, AM-mix starts
 * AS7  — sector 14/15, AS/AR mixed, PM-mix starts
 * MID  — midnight (MS, MG, MS/MG, MID MIX)
 * RELIEF — relief assignments
 */
final class CondensedDeskClassifier
{
    /** @var list<string> */
    public const BUCKETS = [
        'DG7',
        'AG15',
        'DR7',
        'AR15',
        'DS7',
        'AS7',
        'MID',
        'RELIEF',
    ];

    /** @var array<string, string> */
    public const LABELS = [
        'DG7' => 'Regional 06/07',
        'AG15' => 'Regional 14/15',
        'DR7' => 'Router 06/07',
        'AR15' => 'Router 14/15',
        'DS7' => 'Sector 06/07 (incl. DS/DR mix)',
        'AS7' => 'Sector 14/15 (incl. AS/AR mix)',
        'MID' => 'Midnight',
        'RELIEF' => 'Relief',
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
        $shift = $this->shiftFromStartKey($startKey);

        if ($this->isMidLine($group, $startKey)) {
            return 'MID';
        }

        if ($this->isDsDrMix($group, $startKey)) {
            return 'DS7';
        }

        if ($this->isAsArMix($group, $startKey)) {
            return 'AS7';
        }

        $family = $this->dominantFamily($line, $group);

        return match ($family) {
            'regional' => $shift === 'pm' ? 'AG15' : 'DG7',
            'router' => $shift === 'pm' ? 'AR15' : 'DR7',
            'sector' => $shift === 'pm' ? 'AS7' : 'DS7',
            default => 'unknown',
        };
    }

    public function labelForBucket(string $bucket): string
    {
        return self::LABELS[$bucket] ?? $bucket;
    }

    /**
     * Map a line's clock start to a tiebreak key (6, 7, 14, 15, 22).
     */
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
            if (in_array(strtoupper((string) $entry['key']), self::BUCKETS, true)) {
                return true;
            }
        }

        return false;
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

    private function isMidLine(string $group, string $startKey): bool
    {
        if (str_contains($group, 'MID') || preg_match('/^(MS|MG)/', $group)) {
            return true;
        }

        if ($startKey === 'mid_mix' || $startKey === 'mid' || preg_match('/^t_22/', $startKey)) {
            return true;
        }

        return false;
    }

    private function isDsDrMix(string $group, string $startKey): bool
    {
        if (str_starts_with($startKey, 'am_mix')) {
            return true;
        }

        if ($group === '') {
            return false;
        }

        if (preg_match('/DS.*DR|DR.*DS/', $group)) {
            return true;
        }

        if (str_contains($group, 'MIX') && ! str_contains($group, 'MID')) {
            $hasDs = str_contains($group, 'DS');
            $hasDr = str_contains($group, 'DR');

            return $hasDs || $hasDr;
        }

        return false;
    }

    private function isAsArMix(string $group, string $startKey): bool
    {
        if ($startKey === 'pm_mix') {
            return true;
        }

        if ($group === '') {
            return false;
        }

        if (preg_match('/AS.*AR|AR.*AS/', $group)) {
            return true;
        }

        if (str_contains($group, 'MIX') && ! str_contains($group, 'MID')) {
            $hasAs = str_contains($group, 'AS');
            $hasAr = str_contains($group, 'AR');

            return $hasAs || $hasAr;
        }

        return false;
    }

    /**
     * @return 'regional'|'router'|'sector'|null
     */
    private function dominantFamily(BidLine $line, string $group): ?string
    {
        $freq = ['regional' => 0, 'router' => 0, 'sector' => 0];

        foreach ($line->days as $day) {
            if ($day->is_off || $day->normalized_code === null) {
                continue;
            }

            $family = $this->familyForCode(strtoupper(trim($day->normalized_code)));
            if ($family !== null) {
                $freq[$family]++;
            }
        }

        arsort($freq);
        $top = array_key_first($freq);
        if ($top !== null && $freq[$top] > 0) {
            return $top;
        }

        return $this->familyForCode($group);
    }

    /**
     * @return 'regional'|'router'|'sector'|null
     */
    private function familyForCode(string $code): ?string
    {
        if ($code === '') {
            return null;
        }

        if (preg_match('/^(AG|DG)/', $code)) {
            return 'regional';
        }

        if (preg_match('/^(AR|DR)/', $code)) {
            return 'router';
        }

        if (preg_match('/^(AS|DS)/', $code)) {
            return 'sector';
        }

        return null;
    }

    /**
     * @return 'am'|'pm'|'mid'
     */
    private function shiftFromStartKey(string $startKey): string
    {
        if ($startKey === 'pm' || $startKey === 'pm_mix' || preg_match('/^t_1[45]/', $startKey)) {
            return 'pm';
        }

        if ($startKey === 'mid' || $startKey === 'mid_mix' || preg_match('/^t_22/', $startKey)) {
            return 'mid';
        }

        return 'am';
    }
}
