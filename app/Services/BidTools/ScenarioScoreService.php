<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenario;
use Illuminate\Support\Collection;

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
        private readonly VacationCostCalculator $vacation,
    ) {}

    /** @var list<string> */
    public const START_TIME_TIEBREAK_KEYS = ['6', '7', '14', '15', '22'];

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
        $startTimeTiebreak = self::normalizeStartTimeTiebreakOrder(
            $weights['start_time_tiebreak_order'] ?? $weights['shift_order'] ?? null,
        );
        $sortMode = self::normalizeSortMode($weights['sort_mode'] ?? null);

        $bidYear = (int) $scenario->import->bid_year;
        $holidayEntries = $this->normalizeHolidayRank($scenario->holiday_rank, $bidYear);
        $personalEntries = $this->normalizePersonalDates($scenario->personal_dates ?? []);
        $deskEntries = $this->migrateDeskRankKeys(
            $this->normalizeKeyedRank($scenario->desk_rank, $this->defaultDeskRank()),
        );
        $deskMappings = $this->condensedDesk->normalizeMappings($scenario->desk_bucket_mappings ?? []);

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
                foreach (self::datesCoveredByPersonalEntry($e) as $date) {
                    if (($byDate[$date] ?? false) === true) {
                        $personalPoints += $mul * $posW;
                    }
                }
            }
            $personalPoints *= (float) ($weights['personal'] ?? 1);

            $deskInfo = $this->dominantDesk->analyze($line);
            $bucket = $this->condensedDesk->normalizeBucketKey(
                $this->condensedDesk->bucketForLine($line, $deskMappings),
            );
            $deskPoints = $this->scoreKeyedPreference($deskEntries, $bucket)
                * (float) ($weights['desk'] ?? 1);

            $vacCost = $this->vacation->totalCost($scenario, $line);
            $bank = max(1, (int) $scenario->vacation_bank);
            $vacPenalty = min($vacCost, $bank * 2) * (float) ($weights['vacation_penalty'] ?? 1);

            $metrics = $this->lineMetrics->analyze($line);

            $parts = [
                'holiday' => $holidayPoints,
                'personal' => $personalPoints,
                'desk' => $deskPoints,
            ];

            $total = $holidayPoints + $personalPoints + $deskPoints - $vacPenalty;

            $out[] = [
                'bid_line_id' => $line->id,
                'line_num' => $line->line_num,
                'total' => round($total, 2),
                'start_time_tiebreak_key' => $this->condensedDesk->startTimeTiebreakKey($line),
                'parts' => [
                    'holiday' => round($holidayPoints, 2),
                    'personal' => round($personalPoints, 2),
                    'desk' => round($deskPoints, 2),
                ],
                'tier_ranks' => [
                    'holiday' => $this->holidayTierRank($holidayEntries, $byDate),
                    'personal' => $this->personalTierRank($personalEntries, $byDate),
                    'desk' => RankTierHelper::tierRankForKey(
                        $deskEntries,
                        $bucket,
                        fn (string $key): string => $this->condensedDesk->normalizeBucketKey($key),
                    ),
                ],
                'breakdown' => [
                    'holiday' => round($holidayPoints, 2),
                    'personal' => round($personalPoints, 2),
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

        usort($out, fn ($a, $b) => self::compareScoredLines($a, $b, $criteriaOrder, $sortMode, $startTimeTiebreak));

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
            'desk' => 1.0,
            'vacation_penalty' => 1.0,
            'sort_mode' => self::SORT_MODE_BLENDED,
            'criteria_order' => ['holiday', 'personal', 'desk'],
            'start_time_tiebreak_order' => ['6', '7', '14', '15', '22'],
        ];
    }

    /**
     * @return list<string>
     */
    public static function normalizeStartTimeTiebreakOrder(mixed $raw): array
    {
        $default = self::START_TIME_TIEBREAK_KEYS;

        if (is_array($raw)) {
            $migrated = [];
            foreach ($raw as $item) {
                if (! is_string($item)) {
                    continue;
                }
                if ($item === 'am') {
                    $migrated[] = '6';
                    $migrated[] = '7';
                } elseif ($item === 'pm') {
                    $migrated[] = '14';
                    $migrated[] = '15';
                } elseif ($item === 'mid') {
                    $migrated[] = '22';
                } elseif (in_array($item, $default, true)) {
                    $migrated[] = $item;
                }
            }
            if ($migrated !== []) {
                $raw = $migrated;
            }
        }

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

    /** @deprecated Use normalizeStartTimeTiebreakOrder */
    public static function normalizeShiftOrder(mixed $raw): array
    {
        return self::normalizeStartTimeTiebreakOrder($raw);
    }

    public static function normalizeSortMode(mixed $raw): string
    {
        return is_string($raw) && in_array($raw, self::SORT_MODES, true)
            ? $raw
            : self::SORT_MODE_BLENDED;
    }

    /**
     * @return list<string>
     */
    public static function normalizeCriteriaOrder(mixed $raw): array
    {
        $default = ['holiday', 'personal', 'desk'];
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

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     * @param  list<string>  $criteriaOrder
     * @param  list<string>  $startTimeTiebreak
     */
    public static function compareScoredLines(
        array $a,
        array $b,
        array $criteriaOrder,
        string $sortMode,
        array $startTimeTiebreak = ['6', '7', '14', '15', '22'],
    ): int {
        if (self::usesTierGroupSort($sortMode)) {
            foreach ($criteriaOrder as $criterion) {
                if (! is_string($criterion)) {
                    continue;
                }

                $cmp = self::compareCriterionTierRanks($a, $b, $criterion);
                if ($cmp !== 0) {
                    return $cmp;
                }
            }

            $tiebreakCmp = self::compareStartTimeTiebreak(
                (string) ($a['start_time_tiebreak_key'] ?? 'other'),
                (string) ($b['start_time_tiebreak_key'] ?? 'other'),
                $startTimeTiebreak,
            );
            if ($tiebreakCmp !== 0) {
                return $tiebreakCmp;
            }

            return strcmp((string) ($a['line_num'] ?? ''), (string) ($b['line_num'] ?? ''));
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

        $tiebreakCmp = self::compareStartTimeTiebreak(
            (string) ($a['start_time_tiebreak_key'] ?? 'other'),
            (string) ($b['start_time_tiebreak_key'] ?? 'other'),
            $startTimeTiebreak,
        );
        if ($tiebreakCmp !== 0) {
            return $tiebreakCmp;
        }

        return strcmp((string) ($a['line_num'] ?? ''), (string) ($b['line_num'] ?? ''));
    }

    /**
     * @param  list<string>  $tiebreakOrder
     */
    private static function compareStartTimeTiebreak(string $aKey, string $bKey, array $tiebreakOrder): int
    {
        $aRank = self::tiebreakRank($aKey, $tiebreakOrder);
        $bRank = self::tiebreakRank($bKey, $tiebreakOrder);
        if ($aRank === $bRank) {
            return 0;
        }

        return $aRank <=> $bRank;
    }

    /**
     * @param  list<string>  $tiebreakOrder
     */
    private static function tiebreakRank(string $key, array $tiebreakOrder): int
    {
        if ($key === '' || $key === 'other') {
            return PHP_INT_MAX;
        }

        $idx = array_search($key, $tiebreakOrder, true);

        return $idx === false ? PHP_INT_MAX : (int) $idx;
    }

    public static function usesTierGroupSort(string $sortMode): bool
    {
        return in_array($sortMode, [self::SORT_MODE_PRIORITY, self::SORT_MODE_BLENDED], true);
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function compareCriterionTierRanks(array $a, array $b, string $criterion): int
    {
        $aTier = (int) ($a['tier_ranks'][$criterion] ?? PHP_INT_MAX);
        $bTier = (int) ($b['tier_ranks'][$criterion] ?? PHP_INT_MAX);
        if ($aTier === $bTier) {
            return 0;
        }

        return $aTier <=> $bTier;
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

    public function holidayEntriesForEditor(mixed $raw, int $bidYear): array
    {
        return $this->normalizeHolidayRank($raw, $bidYear);
    }

    /**
     * @param  list<string>|list<array<string, mixed>>|null  $raw
     * @param  list<string>|null  $importKeys  Desk buckets present in CSV (merged into editor if missing)
     */
    public function deskEntriesForEditor(mixed $raw, ?array $importKeys = null): array
    {
        $entries = $this->mergeMissingKeyedEntries(
            $this->normalizeKeyedRank($raw, $this->defaultDeskRank()),
            $importKeys ?? []
        );

        return $this->migrateDeskRankKeys($entries);
    }

    /**
     * @param  list<array{key: string, priority: string, tier?: int}>  $entries
     * @return list<array{key: string, priority: string, tier?: int}>
     */
    private function migrateDeskRankKeys(array $entries): array
    {
        $seen = [];
        $out = [];
        foreach ($entries as $entry) {
            $key = $this->condensedDesk->normalizeBucketKey((string) $entry['key']);
            if (isset($seen[$key])) {
                continue;
            }
            $migrated = $entry;
            $migrated['key'] = $key;
            $out[] = $migrated;
            $seen[$key] = true;
        }

        return RankTierHelper::normalizeTierOrder($out);
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
     * @return list<array{date?: string, starts_on?: string, ends_on?: string, label: string, priority: string}>
     */
    public function personalDatesForEditor(mixed $raw, ?array $legacyVacationRanges = null): array
    {
        $entries = $this->normalizePersonalDates($raw);

        if ($legacyVacationRanges === null || $legacyVacationRanges === []) {
            return $entries;
        }

        foreach ($legacyVacationRanges as $range) {
            if (! is_array($range)) {
                continue;
            }
            $startsOn = (string) ($range['starts_on'] ?? '');
            $endsOn = (string) ($range['ends_on'] ?? '');
            if ($startsOn === '' || $endsOn === '') {
                continue;
            }
            $entries[] = [
                'starts_on' => $startsOn,
                'ends_on' => $endsOn,
                'label' => (string) ($range['title'] ?? $range['label'] ?? ''),
                'priority' => 'high',
            ];
        }

        return $entries;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return list<string>
     */
    private static function datesCoveredByPersonalEntry(array $entry): array
    {
        $startsOn = (string) ($entry['starts_on'] ?? '');
        $endsOn = (string) ($entry['ends_on'] ?? '');
        if ($startsOn !== '' && $endsOn !== '') {
            $dates = [];
            $start = \Carbon\CarbonImmutable::parse($startsOn)->startOfDay();
            $end = \Carbon\CarbonImmutable::parse($endsOn)->startOfDay();
            $d = $start;
            while ($d->lte($end)) {
                $dates[] = $d->format('Y-m-d');
                $d = $d->addDay();
            }

            return $dates;
        }

        $date = (string) ($entry['date'] ?? '');

        return $date !== '' ? [$date] : [];
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
            if (! is_array($row)) {
                continue;
            }

            $startsOn = (string) ($row['starts_on'] ?? '');
            $endsOn = (string) ($row['ends_on'] ?? '');
            if ($startsOn !== '' && $endsOn !== '') {
                $out[] = [
                    'starts_on' => $startsOn,
                    'ends_on' => $endsOn,
                    'label' => (string) ($row['label'] ?? ''),
                    'priority' => in_array($row['priority'] ?? 'high', ['ignore', 'low', 'high'], true)
                        ? $row['priority']
                        : 'high',
                ];

                continue;
            }

            if (empty($row['date'])) {
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
        return CondensedDeskClassifier::BUCKETS;
    }

    /**
     * @param  list<array{key: string, priority: string}>  $entries
     */
    private function scoreKeyedPreference(array $entries, string $lineKey): float
    {
        $normalized = RankTierHelper::normalizeTierOrder($entries);

        foreach ($normalized as $i => $e) {
            $key = $this->condensedDesk->normalizeBucketKey((string) $e['key']);
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

    /**
     * @param  list<array<string, mixed>>  $holidayEntries
     * @param  array<string, bool>  $byDate
     */
    private function holidayTierRank(array $holidayEntries, array $byDate): int
    {
        $worst = count($holidayEntries) + 1;

        foreach ($holidayEntries as $i => $entry) {
            if (($entry['priority'] ?? 'high') === 'ignore') {
                continue;
            }

            $date = $entry['date'] ?? null;
            if (! is_string($date) || $date === '') {
                continue;
            }

            if (($byDate[$date] ?? false) === true) {
                return $i + 1;
            }
        }

        return $worst;
    }

    /**
     * @param  list<array<string, mixed>>  $personalEntries
     * @param  array<string, bool>  $byDate
     */
    private function personalTierRank(array $personalEntries, array $byDate): int
    {
        $worst = count($personalEntries) + 1;

        foreach ($personalEntries as $i => $entry) {
            if (($entry['priority'] ?? 'high') === 'ignore') {
                continue;
            }

            foreach (self::datesCoveredByPersonalEntry($entry) as $date) {
                if (($byDate[$date] ?? false) === true) {
                    return $i + 1;
                }
            }
        }

        return $worst;
    }

    /**
     * Score lines using unsaved draft profile fields (for live preview).
     *
     * @param  array<string, mixed>  $draft
     * @param  list<int>  $lineIds
     * @return list<array<string, mixed>>
     */
    public function scoreLinesWithDraft(BidScenario $scenario, array $draft, array $lineIds): array
    {
        $scenario->loadMissing('import');

        $fillable = [
            'vacation_bank',
            'weights',
            'holiday_rank',
            'desk_rank',
            'personal_dates',
            'desk_bucket_mappings',
        ];

        $original = [];
        foreach ($fillable as $key) {
            $original[$key] = $scenario->getAttribute($key);
        }

        foreach ($fillable as $key) {
            if (array_key_exists($key, $draft)) {
                $scenario->setAttribute($key, $draft[$key]);
            }
        }

        try {
            return $this->scoreLines($scenario, $lineIds);
        } finally {
            foreach ($fillable as $key) {
                $scenario->setAttribute($key, $original[$key]);
            }
        }
    }
}
