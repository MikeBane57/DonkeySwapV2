<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenario;

final class ScenarioScoreService
{
    public const SORT_MODE_WEIGHTED = 'weighted';

    public const SORT_MODE_PRIORITY = 'priority';

    public const SORT_MODE_BLENDED = 'blended';

    /** @var list<string> */
    public const SORT_MODES = [
        self::SORT_MODE_WEIGHTED,
        self::SORT_MODE_PRIORITY,
        self::SORT_MODE_BLENDED,
    ];

    private const PRIORITY_MUL = [
        'ignore' => 0.0,
        'low' => 1.0,
        'high' => 3.0,
    ];

    public function __construct(
        private readonly FederalHolidayCalendar $holidays,
        private readonly LineMetricsService $lineMetrics,
        private readonly DominantDeskAnalyzer $dominantDesk,
        private readonly CondensedDeskClassifier $condensedDesk,
        private readonly StartTimeNormalizer $startTimes,
        private readonly VacationCostCalculator $vacation,
        private readonly LineShiftClassifier $lineShift,
    ) {}

    /**
     * @param  list<int>  $lineIds
     * @return list<array<string, mixed>>
     */
    public function scoreLines(BidScenario $scenario, array $lineIds): array
    {
        $scenario->loadMissing('import');

        $weights = $scenario->weights ?? [];
        $weights = array_merge(self::defaultWeights(), $weights);

        $criteriaOrder = self::normalizeCriteriaOrder($weights['criteria_order'] ?? null);
        $sortMode = self::normalizeSortMode($weights['sort_mode'] ?? null);
        $strictShiftOrder = self::normalizeStrictShiftOrder($weights['strict_shift_order'] ?? null);

        $bidYear = (int) $scenario->import->bid_year;
        $holidayEntries = $this->normalizeHolidayRank($scenario->holiday_rank, $bidYear);
        $personalEntries = $this->normalizePersonalDates($scenario->personal_dates ?? []);
        $deskEntries = $this->normalizeKeyedRank($scenario->desk_rank, $this->defaultDeskRank());
        $startEntries = $this->normalizeKeyedRank($scenario->start_time_rank, $this->defaultStartRank());

        $lines = BidLine::query()
            ->where('bid_import_id', $scenario->bid_import_id)
            ->whereIn('id', $lineIds)
            ->with('days')
            ->get()
            ->keyBy('id');

        $out = [];
        foreach ($lineIds as $lid) {
            $line = $lines->get($lid);
            if (! $line) {
                continue;
            }
            $line->loadMissing('import');
            $byDate = [];
            foreach ($line->days as $d) {
                $byDate[$d->assignment_date->format('Y-m-d')] = $d->is_off;
            }

            $hc = count($holidayEntries);
            $holidayPoints = 0.0;
            foreach ($holidayEntries as $i => $e) {
                $p = $e['priority'] ?? 'high';
                if ($p === 'ignore') {
                    continue;
                }
                $mul = self::PRIORITY_MUL[$p] ?? 1.0;
                $posW = max(1, $hc - $i);
                $date = $e['date'];
                if (($byDate[$date] ?? false) === true) {
                    $holidayPoints += $mul * $posW;
                }
            }
            $holidayPoints *= (float) ($weights['holiday'] ?? 1);

            $pc = count($personalEntries);
            $personalPoints = 0.0;
            foreach ($personalEntries as $i => $e) {
                $p = $e['priority'] ?? 'high';
                if ($p === 'ignore') {
                    continue;
                }
                $mul = self::PRIORITY_MUL[$p] ?? 1.0;
                $posW = max(1, $pc - $i);
                if (($byDate[$e['date']] ?? false) === true) {
                    $personalPoints += $mul * $posW;
                }
            }
            $personalPoints *= (float) ($weights['personal'] ?? 1);

            $lineStartKey = $this->startTimes->rankKey($line->start_time);
            $startPoints = $this->scoreKeyedPreference($startEntries, $lineStartKey)
                * (float) ($weights['start_time'] ?? 1);

            $deskInfo = $this->dominantDesk->analyze($line);
            $bucket = $this->deskBucketForLine($line, $deskEntries);
            $deskPoints = $this->scoreKeyedPreference($deskEntries, $bucket)
                * (float) ($weights['desk'] ?? 1);

            $vacCost = $this->vacation->totalCost($scenario, $line);
            $bank = max(1, (int) $scenario->vacation_bank);
            $vacPenalty = min($vacCost, $bank * 2) * (float) ($weights['vacation_penalty'] ?? 1);

            $metrics = $this->lineMetrics->analyze($line);

            $parts = [
                'holiday' => $holidayPoints,
                'personal' => $personalPoints,
                'start_time' => $startPoints,
                'desk' => $deskPoints,
            ];

            $total = $holidayPoints + $personalPoints + $startPoints + $deskPoints - $vacPenalty;

            $shiftClass = $this->lineShift->classify($line);

            $out[] = [
                'bid_line_id' => $line->id,
                'line_num' => $line->line_num,
                'total' => round($total, 2),
                'shift_class' => $shiftClass,
                'parts' => [
                    'holiday' => round($holidayPoints, 2),
                    'personal' => round($personalPoints, 2),
                    'start_time' => round($startPoints, 2),
                    'desk' => round($deskPoints, 2),
                ],
                'tier_ranks' => [
                    'start_time' => RankTierHelper::tierRankForKey($startEntries, $lineStartKey),
                    'desk' => RankTierHelper::tierRankForKey($deskEntries, $bucket),
                ],
                'breakdown' => [
                    'holiday' => round($holidayPoints, 2),
                    'personal' => round($personalPoints, 2),
                    'start_time' => round($startPoints, 2),
                    'desk' => round($deskPoints, 2),
                    'vacation_cost' => $vacCost,
                    'vacation_penalty' => round($vacPenalty, 2),
                    'vacation_over_bank' => $vacCost > $scenario->vacation_bank,
                    'metrics' => $metrics,
                    'group_bucket' => $bucket,
                    'raw_group_bucket' => $deskInfo['group_bucket'],
                ],
            ];
        }

        usort($out, fn ($a, $b) => self::compareScoredLines($a, $b, $criteriaOrder, $sortMode, $strictShiftOrder));

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    public static function defaultWeights(): array
    {
        return [
            'holiday' => 1.0,
            'personal' => 1.0,
            'start_time' => 1.0,
            'desk' => 1.0,
            'vacation_penalty' => 1.0,
            'sort_mode' => self::SORT_MODE_BLENDED,
            'strict_shift_order' => false,
            'criteria_order' => ['holiday', 'personal', 'start_time', 'desk'],
        ];
    }

    public static function normalizeSortMode(mixed $raw): string
    {
        return is_string($raw) && in_array($raw, self::SORT_MODES, true)
            ? $raw
            : self::SORT_MODE_WEIGHTED;
    }

    /**
     * @return list<string>
     */
    public static function normalizeCriteriaOrder(mixed $raw): array
    {
        $default = ['holiday', 'personal', 'start_time', 'desk'];
        if (! is_array($raw)) {
            return $default;
        }

        $allowed = array_flip($default);
        $order = [];
        foreach ($raw as $key) {
            if (is_string($key) && isset($allowed[$key]) && ! in_array($key, $order, true)) {
                $order[] = $key;
            }
        }

        foreach ($default as $key) {
            if (! in_array($key, $order, true)) {
                $order[] = $key;
            }
        }

        return $order;
    }

    public static function normalizeStrictShiftOrder(mixed $raw): bool
    {
        return filter_var($raw, FILTER_VALIDATE_BOOL);
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     * @param  list<string>  $criteriaOrder
     */
    public static function compareScoredLines(array $a, array $b, array $criteriaOrder, string $sortMode, bool $strictShiftOrder = false): int
    {
        if ($strictShiftOrder) {
            $shiftCmp = self::compareShiftClass($a, $b);
            if ($shiftCmp !== 0) {
                return $shiftCmp;
            }
        }
        if (self::usesTierGroupSort($sortMode)) {
            foreach ($criteriaOrder as $criterion) {
                if (! is_string($criterion)) {
                    continue;
                }

                if (in_array($criterion, ['start_time', 'desk'], true)) {
                    $aTier = (int) ($a['tier_ranks'][$criterion] ?? PHP_INT_MAX);
                    $bTier = (int) ($b['tier_ranks'][$criterion] ?? PHP_INT_MAX);
                    if ($aTier !== $bTier) {
                        return $aTier <=> $bTier;
                    }

                    continue;
                }

                $cmp = self::compareCriterionParts($a, $b, $criterion);
                if ($cmp !== 0) {
                    return $cmp;
                }
            }
        } elseif ($sortMode === self::SORT_MODE_WEIGHTED) {
            $totalCmp = $b['total'] <=> $a['total'];
            if ($totalCmp !== 0) {
                return $totalCmp;
            }

            foreach ($criteriaOrder as $criterion) {
                $cmp = self::compareCriterionParts($a, $b, $criterion);
                if ($cmp !== 0) {
                    return $cmp;
                }
            }
        }

        $totalCmp = $b['total'] <=> $a['total'];
        if ($totalCmp !== 0) {
            return $totalCmp;
        }

        return strcmp((string) ($a['line_num'] ?? ''), (string) ($b['line_num'] ?? ''));
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function compareShiftClass(array $a, array $b): int
    {
        $order = array_flip(LineShiftClassifier::STRICT_ORDER);
        $worst = count(LineShiftClassifier::STRICT_ORDER);
        $left = $order[$a['shift_class'] ?? LineShiftClassifier::SHIFT_OTHER] ?? $worst;
        $right = $order[$b['shift_class'] ?? LineShiftClassifier::SHIFT_OTHER] ?? $worst;

        return $left <=> $right;
    }

    public static function usesTierGroupSort(string $sortMode): bool
    {
        return in_array($sortMode, [self::SORT_MODE_PRIORITY, self::SORT_MODE_BLENDED], true);
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function compareCriterionParts(array $a, array $b, mixed $criterion): int
    {
        if (! is_string($criterion)) {
            return 0;
        }

        $left = (float) ($a['parts'][$criterion] ?? 0);
        $right = (float) ($b['parts'][$criterion] ?? 0);

        if ($left === $right) {
            return 0;
        }

        return $right <=> $left;
    }

    /**
     * @return list<array{date: string, label: string, priority: string, id?: string}>
     */
    /**
     * @return list<array{date: string, id: string, label: string}>
     */
    public function holidaysCatalog(int $bidYear): array
    {
        return $this->holidays->holidaysInBidYear($bidYear)
            ->map(fn (array $meta, string $date) => [
                'date' => $date,
                'id' => $meta['id'],
                'label' => $meta['label'],
            ])
            ->sortKeys()
            ->values()
            ->all();
    }

    public function defaultHolidayEntries(int $bidYear): array
    {
        return $this->holidays->holidaysInBidYear($bidYear)
            ->map(fn (array $meta, string $date) => [
                'date' => $date,
                'label' => $meta['label'],
                'id' => $meta['id'],
                'priority' => 'high',
            ])
            ->sortKeys()
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    public function defaultHolidayDates(int $bidYear): array
    {
        return $this->holidays->holidaysInBidYear($bidYear)->keys()->sort()->values()->all();
    }

    /**
     * @return list<array{key: string, priority: string}>
     */
    public function defaultDeskEntries(): array
    {
        return collect($this->defaultDeskRank())
            ->map(fn (string $k) => ['key' => $k, 'priority' => 'high'])
            ->all();
    }

    /**
     * @return list<array{key: string, priority: string}>
     */
    public function defaultStartTimeEntries(): array
    {
        return collect($this->defaultStartRank())
            ->map(fn (string $k) => ['key' => $k, 'priority' => 'high'])
            ->all();
    }

    /**
     * @param  list<array{key: string, priority?: string}>  $deskEntries
     */
    private function deskBucketForLine(BidLine $line, array $deskEntries): string
    {
        if ($this->condensedDesk->usesCondensedBuckets($deskEntries)) {
            return $this->condensedDesk->bucketForLine($line);
        }

        return $this->dominantDesk->analyze($line)['group_bucket'];
    }

    /**
     * @param  list<array{key: string, priority: string}>  $entries
     */
    private function scoreKeyedPreference(array $entries, string $lineKey): float
    {
        $normalized = RankTierHelper::normalizeTierOrder($entries);
        $tierCount = count(RankTierHelper::orderedTiers($normalized));

        foreach ($normalized as $i => $e) {
            $key = $e['key'];
            $p = $e['priority'] ?? 'high';
            if ($p === 'ignore') {
                continue;
            }
            if ($lineKey === $key) {
                $mul = self::PRIORITY_MUL[$p] ?? 1.0;
                $tierWeight = RankTierHelper::tierWeight($normalized, $i);

                return $mul * $tierWeight;
            }
        }

        return 0.0;
    }

    public function holidayEntriesForEditor(mixed $raw, int $bidYear): array
    {
        return $this->normalizeHolidayRank($raw, $bidYear);
    }

    /**
     * @param  list<string>|list<array<string, mixed>>|null  $raw
     * @return list<array{key: string, priority: string}>
     */
    /**
     * @param  list<string>|list<array<string, mixed>>|null  $raw
     * @param  list<string>|null  $importKeys  Desk buckets present in CSV (merged into editor if missing)
     */
    public function deskEntriesForEditor(mixed $raw, ?array $importKeys = null): array
    {
        $defaults = ($importKeys !== null && $importKeys !== [])
            ? $importKeys
            : $this->defaultDeskRank();

        return $this->mergeMissingKeyedEntries(
            $this->normalizeKeyedRank($raw, $defaults),
            $importKeys ?? []
        );
    }

    /**
     * @param  list<string>|list<array<string, mixed>>|null  $raw
     * @param  list<string>|null  $importKeys  Start-time rank keys present in CSV
     */
    public function startTimeEntriesForEditor(mixed $raw, ?array $importKeys = null): array
    {
        $defaults = ($importKeys !== null && $importKeys !== [])
            ? $importKeys
            : $this->defaultStartRank();

        return $this->mergeMissingKeyedEntries(
            $this->normalizeKeyedRank($raw, $defaults),
            $importKeys ?? []
        );
    }

    /**
     * @param  list<array{key: string, priority: string}>  $entries
     * @param  list<string>  $importKeys
     * @return list<array{key: string, priority: string}>
     */
    private function mergeMissingKeyedEntries(array $entries, array $importKeys): array
    {
        if ($importKeys === []) {
            return $entries;
        }
        $seen = [];
        foreach ($entries as $e) {
            $seen[$e['key']] = true;
        }
        foreach ($importKeys as $k) {
            if ($k === '' || isset($seen[$k])) {
                continue;
            }
            $entries[] = ['key' => $k, 'priority' => 'high'];
            $seen[$k] = true;
        }

        return $entries;
    }

    private function normalizeHolidayRank(mixed $raw, int $bidYear): array
    {
        if ($raw === null || $raw === []) {
            return $this->defaultHolidayEntries($bidYear);
        }
        if (isset($raw[0]) && is_string($raw[0])) {
            $cal = $this->holidays->holidaysInBidYear($bidYear);

            return collect($raw)->map(function (string $date) use ($cal) {
                $meta = $cal->get($date);

                return [
                    'date' => $date,
                    'label' => is_array($meta) ? ($meta['label'] ?? $date) : $date,
                    'id' => is_array($meta) ? ($meta['id'] ?? '') : '',
                    'priority' => 'high',
                ];
            })->all();
        }

        $out = [];
        foreach ($raw as $row) {
            if (! is_array($row) || empty($row['date'])) {
                continue;
            }
            $out[] = [
                'date' => $row['date'],
                'label' => (string) ($row['label'] ?? ''),
                'id' => (string) ($row['id'] ?? ''),
                'priority' => in_array($row['priority'] ?? 'high', ['ignore', 'low', 'high'], true)
                    ? $row['priority']
                    : 'high',
            ];
        }

        return $out === [] ? $this->defaultHolidayEntries($bidYear) : $out;
    }

    /**
     * @return list<array{date: string, label: string, priority: string}>
     */
    public function personalDatesForEditor(mixed $raw): array
    {
        return $this->normalizePersonalDates($raw);
    }

    private function normalizePersonalDates(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $row) {
            if (is_string($row)) {
                $out[] = ['date' => $row, 'label' => '', 'priority' => 'high'];

                continue;
            }
            if (! is_array($row) || empty($row['date'])) {
                continue;
            }
            $out[] = [
                'date' => $row['date'],
                'label' => (string) ($row['label'] ?? ''),
                'priority' => in_array($row['priority'] ?? 'high', ['ignore', 'low', 'high'], true)
                    ? $row['priority']
                    : 'high',
            ];
        }

        return $out;
    }

    /**
     * @param  list<string>|list<array{key: string, priority?: string}>|null  $raw
     * @param  list<string>  $defaultKeys
     * @return list<array{key: string, priority: string}>
     */
    private function normalizeKeyedRank(mixed $raw, array $defaultKeys): array
    {
        if ($raw === null || $raw === []) {
            return collect($defaultKeys)
                ->map(fn (string $k, int $i) => ['key' => $k, 'priority' => 'high', 'tier' => $i + 1])
                ->all();
        }
        if (isset($raw[0]) && is_string($raw[0])) {
            return collect($raw)
                ->map(fn (string $k, int $i) => ['key' => $k, 'priority' => 'high', 'tier' => $i + 1])
                ->all();
        }
        $out = [];
        foreach ($raw as $i => $row) {
            if (! is_array($row) || empty($row['key'])) {
                continue;
            }
            $entry = [
                'key' => (string) $row['key'],
                'priority' => in_array($row['priority'] ?? 'high', ['ignore', 'low', 'high'], true)
                    ? $row['priority']
                    : 'high',
            ];
            if (isset($row['tier']) && is_numeric($row['tier'])) {
                $entry['tier'] = max(1, (int) $row['tier']);
            }
            $out[] = $entry;
        }

        $out = $out === [] ? collect($defaultKeys)
            ->map(fn (string $k, int $i) => ['key' => $k, 'priority' => 'high', 'tier' => $i + 1])
            ->all() : RankTierHelper::normalizeTierOrder($out);

        return $out;
    }

    /**
     * @return list<string>
     */
    private function defaultDeskRank(): array
    {
        return ['DG', 'DS', 'DR', 'AG', 'mix', 'mg_ms'];
    }

    /**
     * @return list<string>
     */
    private function defaultStartRank(): array
    {
        return ['t_0600', 't_0700', 'am', 'pm', 'mid', 'am_mix_0600_0700'];
    }
}
