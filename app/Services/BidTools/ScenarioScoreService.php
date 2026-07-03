<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use App\Models\BidScenario;
use Carbon\CarbonImmutable;

final class ScenarioScoreService
{
    public const SORT_MODE_WEIGHTED = 'weighted';

    public const SORT_MODE_PRIORITY = 'priority';

    public const SORT_MODE_BLENDED = 'blended';

    public const SORT_MODE_GROUP_RANKED = 'group_ranked';

    /** @var list<string> */
    public const SORT_MODES = [
        self::SORT_MODE_WEIGHTED,
        self::SORT_MODE_PRIORITY,
        self::SORT_MODE_BLENDED,
        self::SORT_MODE_GROUP_RANKED,
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
    public function scoreLines(
        BidScenario $scenario,
        array $lineIds,
        bool $withMetrics = true,
        ?array $deskBucketMappingsOverride = null,
        ?array $lineDeskBucketsOverride = null,
    ): array {
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
        $deskMappings = $this->condensedDesk->normalizeMappings(
            $deskBucketMappingsOverride ?? $scenario->desk_bucket_mappings ?? [],
        );
        $lineDeskBuckets = $this->condensedDesk->normalizeLineBuckets(
            $lineDeskBucketsOverride ?? $scenario->line_desk_buckets ?? [],
        );
        $deskKeys = $this->deskKeysForScoring($scenario, $deskMappings, $lineDeskBuckets);
        $deskEntries = $this->deskEntriesForEditor($scenario->desk_rank, $deskKeys);

        $import = $scenario->import;
        $lines = BidLine::query()
            ->where('bid_import_id', $scenario->bid_import_id)
            ->whereIn('id', $lineIds)
            ->with(['days' => fn ($query) => $query->orderBy('assignment_date')])
            ->get()
            ->keyBy('id');

        $out = [];
        foreach ($lineIds as $lid) {
            $line = $lines->get($lid);
            if (! $line) {
                continue;
            }
            if ($import !== null) {
                $line->setRelation('import', $import);
            }
            $byDate = [];
            foreach ($line->days as $d) {
                $byDate[$d->assignment_date->format('Y-m-d')] = $d->is_off;
            }

            $holidaySortScore = $this->scoreHolidayPreference($holidayEntries, $byDate);
            $holidayPoints = $holidaySortScore * (float) ($weights['holiday'] ?? 1);

            $personalSortScore = $this->scorePersonalPreference($personalEntries, $byDate);
            $personalPoints = $personalSortScore * (float) ($weights['personal'] ?? 1);

            $deskInfo = $this->dominantDesk->analyze($line);
            $bucket = $this->condensedDesk->normalizeBucketKey(
                $this->condensedDesk->bucketForLine($line, $deskMappings, $lineDeskBuckets),
            );
            $deskSortScore = $this->scoreKeyedPreference($deskEntries, $bucket);
            $deskPoints = $deskSortScore * (float) ($weights['desk'] ?? 1);

            $vacCost = $this->vacation->totalCost($scenario, $line);
            $bank = max(1, (int) $scenario->vacation_bank);
            $vacPenalty = min($vacCost, $bank * 2) * (float) ($weights['vacation_penalty'] ?? 1);

            $metrics = $withMetrics
                ? $this->lineMetrics->analyze($line)
                : [
                    'holidays_off' => 0,
                    'key_holidays' => [
                        'christmas' => [
                            'off' => 0,
                            'total' => 0,
                            'anchor_label' => null,
                            'anchor_off' => false,
                            'days_off_before' => 0,
                            'days_off_after' => 0,
                            'dates' => [],
                        ],
                        'thanksgiving' => [
                            'off' => 0,
                            'total' => 0,
                            'anchor_label' => null,
                            'anchor_off' => false,
                            'days_off_before' => 0,
                            'days_off_after' => 0,
                            'dates' => [],
                        ],
                        'july_4' => [
                            'off' => 0,
                            'total' => 0,
                            'anchor_label' => null,
                            'anchor_off' => false,
                            'days_off_before' => 0,
                            'days_off_after' => 0,
                            'dates' => [],
                        ],
                    ],
                    'fri_off' => 0,
                    'sat_off' => 0,
                    'sun_off' => 0,
                    'fri_sat_sun_all_off' => 0,
                    'sat_sun_both_off' => 0,
                    'sept_feb' => [
                        'fri_off' => 0,
                        'sat_off' => 0,
                        'sun_off' => 0,
                        'fri_sat_sun_all_off' => 0,
                        'sat_sun_both_off' => 0,
                    ],
                ];

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
                'sort_scores' => [
                    'holiday' => round($holidaySortScore, 2),
                    'personal' => round($personalSortScore, 2),
                    'desk' => round($deskSortScore, 2),
                ],
                'tier_ranks' => [
                    'holiday' => $this->holidayTierRank($holidayEntries, $byDate),
                    'personal' => $this->personalTierRank($personalEntries, $byDate),
                    'desk' => RankTierHelper::tierRankForKey(
                        $deskEntries,
                        $bucket,
                        fn (string $key): string => $this->condensedDesk->normalizeBucketKey($key),
                    ),
                    'desk_order' => RankTierHelper::listRankForKey(
                        $deskEntries,
                        $bucket,
                        fn (string $key): string => $this->condensedDesk->normalizeBucketKey($key),
                    ),
                    'desk_group' => RankTierHelper::tierGroupIndexForKey(
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

        if ($sortMode === self::SORT_MODE_GROUP_RANKED) {
            return self::sortGroupRankedLines($out, $criteriaOrder, $startTimeTiebreak);
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
        if ($sortMode === self::SORT_MODE_GROUP_RANKED) {
            $aGroup = (int) ($a['tier_ranks']['desk'] ?? PHP_INT_MAX);
            $bGroup = (int) ($b['tier_ranks']['desk'] ?? PHP_INT_MAX);
            if ($aGroup !== $bGroup) {
                return $aGroup <=> $bGroup;
            }

            return self::compareWithinDeskGroup($a, $b, $criteriaOrder, $startTimeTiebreak);
        } elseif (self::usesTierGroupSort($sortMode)) {
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
     * @param  list<array<string, mixed>>  $lines
     * @param  list<string>  $criteriaOrder
     * @param  list<string>  $startTimeTiebreak
     * @return list<array<string, mixed>>
     */
    public static function sortGroupRankedLines(
        array $lines,
        array $criteriaOrder,
        array $startTimeTiebreak = ['6', '7', '14', '15', '22'],
    ): array {
        if ($lines === []) {
            return [];
        }

        $groups = [];
        foreach ($lines as $line) {
            $group = (int) ($line['tier_ranks']['desk'] ?? PHP_INT_MAX);
            $groups[$group][] = $line;
        }

        ksort($groups);

        $out = [];
        foreach ($groups as $groupLines) {
            usort(
                $groupLines,
                fn ($a, $b) => self::compareWithinDeskGroup($a, $b, $criteriaOrder, $startTimeTiebreak),
            );
            array_push($out, ...$groupLines);
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     * @param  list<string>  $criteriaOrder
     * @param  list<string>  $startTimeTiebreak
     */
    public static function compareWithinDeskGroup(
        array $a,
        array $b,
        array $criteriaOrder,
        array $startTimeTiebreak = ['6', '7', '14', '15', '22'],
    ): int {
        foreach ($criteriaOrder as $criterion) {
            if (! is_string($criterion)) {
                continue;
            }

            $cmp = match ($criterion) {
                'desk' => self::compareDeskOrderRanksWithinGroup($a, $b),
                'holiday', 'personal' => self::compareCriterionSortScores($a, $b, $criterion)
                    ?: self::compareCriterionTierRanks($a, $b, $criterion),
                default => 0,
            };
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
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function compareCriterionSortScores(array $a, array $b, string $criterion): int
    {
        $left = (float) ($a['sort_scores'][$criterion] ?? 0);
        $right = (float) ($b['sort_scores'][$criterion] ?? 0);
        if ($left === $right) {
            return 0;
        }

        return $right <=> $left;
    }

    /**
     * Within a desk tier group, desk bucket list order only breaks ties among
     * lines that share the same bucket. Cross-bucket ordering is already
     * expressed by desk tier groups (G1, G2, …).
     *
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function compareDeskOrderRanksWithinGroup(array $a, array $b): int
    {
        $aBucket = (string) ($a['breakdown']['group_bucket'] ?? '');
        $bBucket = (string) ($b['breakdown']['group_bucket'] ?? '');
        if ($aBucket === '' || $bBucket === '' || strcasecmp($aBucket, $bBucket) !== 0) {
            return 0;
        }

        return self::compareDeskOrderRanks($a, $b);
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function compareDeskOrderRanks(array $a, array $b): int
    {
        $aRank = (int) ($a['tier_ranks']['desk_order'] ?? PHP_INT_MAX);
        $bRank = (int) ($b['tier_ranks']['desk_order'] ?? PHP_INT_MAX);
        if ($aRank === $bRank) {
            return 0;
        }

        return $aRank <=> $bRank;
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
        $catalog = $this->holidays->holidaysInBidYear($bidYear);
        $out = [];
        $usedDates = [];

        foreach (FederalHolidayCalendar::DEFAULT_RANKED_HOLIDAY_IDS as $id) {
            foreach ($catalog as $date => $meta) {
                if ($meta['id'] !== $id || isset($usedDates[$date])) {
                    continue;
                }

                $out[] = [
                    'date' => $date,
                    'label' => $meta['label'],
                    'id' => $meta['id'],
                    'priority' => 'high',
                ];
                $usedDates[$date] = true;
            }
        }

        foreach ($catalog->sortKeys() as $date => $meta) {
            if (isset($usedDates[$date])) {
                continue;
            }

            $out[] = [
                'date' => $date,
                'label' => $meta['label'],
                'id' => $meta['id'],
                'priority' => 'ignore',
            ];
        }

        return $out;
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
     * @param  list<array<string, mixed>>  $deskMappings
     * @param  array<int, string>  $lineDeskBuckets
     * @return list<string>
     */
    private function deskKeysForScoring(BidScenario $scenario, array $deskMappings, array $lineDeskBuckets): array
    {
        if ($deskMappings !== [] || $lineDeskBuckets !== []) {
            return $this->condensedDesk->bucketsPresentInImport(
                $scenario->bid_import_id,
                $deskMappings,
                $lineDeskBuckets,
            );
        }

        $fromRank = [];
        foreach ($scenario->desk_rank ?? [] as $entry) {
            if (! is_array($entry) || empty($entry['key'])) {
                continue;
            }
            $key = $this->condensedDesk->normalizeBucketKey((string) $entry['key']);
            if ($key !== '') {
                $fromRank[$key] = true;
            }
        }

        if ($fromRank !== []) {
            return array_values(array_filter(
                CondensedDeskClassifier::BUCKETS,
                fn (string $bucket) => isset($fromRank[$bucket]),
            ));
        }

        return $this->condensedDesk->bucketsPresentInImport(
            $scenario->bid_import_id,
            $deskMappings,
            $lineDeskBuckets,
        );
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

        return RankTierHelper::prepareDeskRankEntries($out);
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
            $seen[$this->condensedDesk->normalizeBucketKey((string) $e['key'])] = true;
        }
        foreach ($importKeys as $k) {
            $normalizedKey = $this->condensedDesk->normalizeBucketKey($k);
            if ($normalizedKey === '' || isset($seen[$normalizedKey])) {
                continue;
            }
            $entries[] = [
                'key' => $normalizedKey,
                'priority' => 'high',
                'tier' => $this->defaultTierForMissingDeskBucket($normalizedKey, $entries),
            ];
            $seen[$normalizedKey] = true;
        }

        return $entries;
    }

    /**
     * @param  list<array{key: string, priority: string, tier?: int}>  $entries
     */
    private function defaultTierForMissingDeskBucket(string $missingKey, array $entries): int
    {
        $catalog = $this->defaultDeskRank();
        $catalogIndex = array_search($missingKey, $catalog, true);
        if ($catalogIndex === false) {
            $maxTier = 0;
            foreach ($entries as $entry) {
                $maxTier = max($maxTier, (int) ($entry['tier'] ?? 0));
            }

            return $maxTier + 1;
        }

        $tierByKey = [];
        foreach ($entries as $entry) {
            $tierByKey[$this->condensedDesk->normalizeBucketKey((string) $entry['key'])] = (int) ($entry['tier'] ?? 1);
        }

        for ($offset = 1; $offset < count($catalog); $offset++) {
            foreach ([$catalogIndex - $offset, $catalogIndex + $offset] as $neighborIndex) {
                if ($neighborIndex < 0 || $neighborIndex >= count($catalog)) {
                    continue;
                }
                $neighborKey = $catalog[$neighborIndex];
                if (isset($tierByKey[$neighborKey])) {
                    return $tierByKey[$neighborKey];
                }
            }
        }

        $maxTier = 0;
        foreach ($entries as $entry) {
            $maxTier = max($maxTier, (int) ($entry['tier'] ?? 0));
        }

        return $maxTier + 1;
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
            $start = CarbonImmutable::parse($startsOn)->startOfDay();
            $end = CarbonImmutable::parse($endsOn)->startOfDay();
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
    private function scoreHolidayPreference(array $holidayEntries, array $byDate): float
    {
        $count = count($holidayEntries);
        $points = 0.0;
        foreach ($holidayEntries as $i => $entry) {
            $priority = $entry['priority'] ?? 'high';
            if ($priority === 'ignore') {
                continue;
            }

            $date = $entry['date'] ?? null;
            if (! is_string($date) || $date === '') {
                continue;
            }

            if (($byDate[$date] ?? false) !== true) {
                continue;
            }

            $mul = self::PRIORITY_MUL[$priority] ?? 1.0;
            $points += $mul * max(1, $count - $i);
        }

        return $points;
    }

    /**
     * @param  list<array<string, mixed>>  $personalEntries
     * @param  array<string, bool>  $byDate
     */
    private function scorePersonalPreference(array $personalEntries, array $byDate): float
    {
        $count = count($personalEntries);
        $points = 0.0;
        foreach ($personalEntries as $i => $entry) {
            $priority = $entry['priority'] ?? 'high';
            if ($priority === 'ignore') {
                continue;
            }

            foreach (self::datesCoveredByPersonalEntry($entry) as $date) {
                if (($byDate[$date] ?? false) !== true) {
                    continue;
                }

                $mul = self::PRIORITY_MUL[$priority] ?? 1.0;
                $points += $mul * max(1, $count - $i);
            }
        }

        return $points;
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
     * Human-readable explanation of how lines were sorted (for UI debugging).
     *
     * @param  list<array<string, mixed>>  $scoredLines
     * @return array<string, mixed>
     */
    public function buildSortExplanation(BidScenario $scenario, array $scoredLines): array
    {
        $scenario->loadMissing('import');

        $weights = array_merge(self::defaultWeights(), $scenario->weights ?? []);
        $criteriaOrder = self::normalizeCriteriaOrder($weights['criteria_order'] ?? null);
        $startTimeTiebreak = self::normalizeStartTimeTiebreakOrder(
            $weights['start_time_tiebreak_order'] ?? $weights['shift_order'] ?? null,
        );
        $sortMode = self::normalizeSortMode($weights['sort_mode'] ?? null);

        $deskMappings = $this->condensedDesk->normalizeMappings($scenario->desk_bucket_mappings ?? []);
        $lineDeskBuckets = $this->condensedDesk->normalizeLineBuckets($scenario->line_desk_buckets ?? []);
        $deskKeys = $this->condensedDesk->bucketsPresentInImport(
            $scenario->bid_import_id,
            $deskMappings,
            $lineDeskBuckets,
        );
        $deskEntries = $this->deskEntriesForEditor($scenario->desk_rank, $deskKeys);

        $deskTierGroups = $this->deskTierGroupsSummary($deskEntries);
        $criteriaLabels = $this->criteriaLabels($criteriaOrder);
        $steps = $this->sortStepsForMode($sortMode, $criteriaLabels, $startTimeTiebreak);

        $lineDetails = [];
        $previousDeskGroup = null;
        $rank = 1;
        $normalizeBucket = fn (string $key): string => $this->condensedDesk->normalizeBucketKey($key);
        foreach ($scoredLines as $row) {
            $bucket = (string) ($row['breakdown']['group_bucket'] ?? '');
            $deskGroup = (int) ($row['tier_ranks']['desk_group'] ?? RankTierHelper::tierGroupIndexForKey(
                $deskEntries,
                $bucket,
                $normalizeBucket,
            ));
            $lineDetails[] = [
                'rank' => $rank++,
                'bid_line_id' => (int) $row['bid_line_id'],
                'line_num' => (string) $row['line_num'],
                'desk_bucket' => $bucket,
                'desk_tier' => (int) ($row['tier_ranks']['desk'] ?? PHP_INT_MAX),
                'desk_tier_label' => 'G'.$deskGroup,
                'group_boundary' => $sortMode === self::SORT_MODE_GROUP_RANKED
                    && $previousDeskGroup !== null
                    && $deskGroup !== $previousDeskGroup,
                'sort_scores' => $row['sort_scores'] ?? [],
                'tier_ranks' => $row['tier_ranks'] ?? [],
                'start_time_tiebreak_key' => (string) ($row['start_time_tiebreak_key'] ?? 'other'),
                'start_time_label' => self::startTimeTiebreakLabel(
                    (string) ($row['start_time_tiebreak_key'] ?? 'other'),
                ),
                'total' => $row['total'] ?? 0,
            ];
            $previousDeskGroup = $deskGroup;
        }

        return [
            'sort_mode' => $sortMode,
            'sort_mode_label' => self::sortModeLabel($sortMode),
            'summary' => self::sortModeSummary($sortMode, $criteriaLabels),
            'steps' => $steps,
            'criteria_order' => $criteriaOrder,
            'criteria_labels' => $criteriaLabels,
            'start_time_tiebreak_order' => $startTimeTiebreak,
            'start_time_tiebreak_labels' => array_map(
                fn (string $key) => self::startTimeTiebreakLabel($key),
                $startTimeTiebreak,
            ),
            'weights' => [
                'holiday' => (float) ($weights['holiday'] ?? 1),
                'personal' => (float) ($weights['personal'] ?? 1),
                'desk' => (float) ($weights['desk'] ?? 1),
                'vacation_penalty' => (float) ($weights['vacation_penalty'] ?? 1),
            ],
            'desk_tier_groups' => $deskTierGroups,
            'line_details' => $lineDetails,
        ];
    }

    public static function sortModeLabel(string $sortMode): string
    {
        return match ($sortMode) {
            self::SORT_MODE_WEIGHTED => 'Weighted',
            self::SORT_MODE_BLENDED => 'Blended',
            self::SORT_MODE_GROUP_RANKED => 'Group ranked',
            self::SORT_MODE_PRIORITY => 'Priority',
            default => 'Blended',
        };
    }

    /**
     * @param  list<string>  $criteriaLabels
     */
    public static function sortModeSummary(string $sortMode, array $criteriaLabels): string
    {
        $chain = implode(' → ', $criteriaLabels);

        return match ($sortMode) {
            self::SORT_MODE_GROUP_RANKED => "Desk tier groups run G1, then G2, then G3… Within each group: {$chain}, then start time, then line number.",
            self::SORT_MODE_WEIGHTED => "Lines sort by total weighted score first. Desk tier groups are not used. Tie-break: {$chain}, then start time, then line number.",
            self::SORT_MODE_BLENDED, self::SORT_MODE_PRIORITY => "Global category order: {$chain}, then start time, then line number.",
            default => "Category order: {$chain}, then start time, then line number.",
        };
    }

    /**
     * @param  list<string>  $criteriaOrder
     * @return list<string>
     */
    private function criteriaLabels(array $criteriaOrder): array
    {
        $labels = [
            'holiday' => 'Holidays',
            'personal' => 'Personal',
            'desk' => 'Desk',
        ];

        return array_values(array_map(
            fn (string $key) => $labels[$key] ?? $key,
            $criteriaOrder,
        ));
    }

    /**
     * @param  list<array<string, mixed>>  $deskEntries
     * @return list<array{tier: int, label: string, buckets: list<string>}>
     */
    private function deskTierGroupsSummary(array $deskEntries): array
    {
        $groups = RankTierHelper::entriesToTierGroups($deskEntries);
        $out = [];

        foreach ($groups as $index => $group) {
            $buckets = [];
            foreach ($group as $entry) {
                if (($entry['priority'] ?? 'high') === 'ignore') {
                    continue;
                }
                $key = $this->condensedDesk->normalizeBucketKey((string) ($entry['key'] ?? ''));
                if ($key === '') {
                    continue;
                }
                $buckets[] = $key;
            }

            if ($buckets === []) {
                continue;
            }

            $groupNumber = $index + 1;
            $out[] = [
                'tier' => $groupNumber,
                'label' => 'G'.$groupNumber,
                'buckets' => $buckets,
                'sort_tier' => (int) ($group[0]['tier'] ?? $groupNumber),
            ];
        }

        return $out;
    }

    /**
     * @param  list<string>  $criteriaLabels
     * @param  list<string>  $startTimeTiebreak
     * @return list<array{label: string, detail: string}>
     */
    private function sortStepsForMode(string $sortMode, array $criteriaLabels, array $startTimeTiebreak): array
    {
        $startLabels = implode(' → ', array_map(
            fn (string $key) => self::startTimeTiebreakLabel($key),
            $startTimeTiebreak,
        ));
        $chain = implode(' → ', $criteriaLabels);

        if ($sortMode === self::SORT_MODE_GROUP_RANKED) {
            return [
                [
                    'label' => 'Desk tier groups',
                    'detail' => 'All lines in G1 are listed before G2, G2 before G3, and so on. Each line\'s group comes from its desk bucket in the desk rank editor.',
                ],
                [
                    'label' => 'Category order within group',
                    'detail' => "{$chain}. Holidays and personal use unweighted preference scores (higher is better), then first-match list position. Desk list position applies only among lines in the same desk bucket — buckets grouped together (e.g. AS and DG in G2) compete on holidays and personal first.",
                ],
                [
                    'label' => 'Start time tiebreak',
                    'detail' => "Preferred order: {$startLabels}.",
                ],
                [
                    'label' => 'Line number',
                    'detail' => 'When still tied, lower line number ranks higher.',
                ],
            ];
        }

        if ($sortMode === self::SORT_MODE_WEIGHTED) {
            return [
                [
                    'label' => 'Total weighted score',
                    'detail' => 'Sum of weighted holiday, personal, and desk points minus vacation penalty. Higher total ranks higher.',
                ],
                [
                    'label' => 'Category tie-break',
                    'detail' => "{$chain} weighted parts when totals match.",
                ],
                [
                    'label' => 'Start time tiebreak',
                    'detail' => "Preferred order: {$startLabels}.",
                ],
                [
                    'label' => 'Line number',
                    'detail' => 'When still tied, lower line number ranks higher.',
                ],
            ];
        }

        return [
            [
                'label' => 'Category order',
                'detail' => "{$chain}. Each category uses list/tier position (lower is better).",
            ],
            [
                'label' => 'Start time tiebreak',
                'detail' => "Preferred order: {$startLabels}.",
            ],
            [
                'label' => 'Line number',
                'detail' => 'When still tied, lower line number ranks higher.',
            ],
        ];
    }

    public static function startTimeTiebreakLabel(string $key): string
    {
        return match ($key) {
            '6' => '0600',
            '7' => '0700',
            '14' => '1400',
            '15' => '1500',
            '22' => '2200 (Mid)',
            default => $key === '' || $key === 'other' ? 'Other' : $key,
        };
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
            'line_desk_buckets',
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
