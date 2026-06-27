<?php

namespace App\Services\BidTools;

use App\Models\BidImport;
use App\Models\BidScenario;

/**
 * Maps simplified bid-simulator profile ranks to full scenario scoring arrays.
 */
final class CondensedBidderProfileMapper
{
    /** @var array<string, list<string>> */
    public const HOLIDAY_GROUPS = [
        'christmas' => ['christmas_eve', 'christmas_day'],
        'thanksgiving' => ['thanksgiving', 'black_friday'],
        'new_years' => ['new_years_eve', 'new_years_day'],
        'july_4' => ['july_4'],
    ];

    /** @var list<string> */
    public const DESK_KEYS = ['XG', 'XR', 'XS', 'MID', 'RELIEF'];

    /** @var list<string> */
    public const START_TIME_KEYS = ['6', '7', '14', '15', '22'];

    /** @var array<string, string> */
    public const START_TIME_RANK_KEY_MAP = [
        '6' => 't_0600',
        '7' => 't_0700',
        '14' => 't_1400',
        '15' => 't_1500',
        '22' => 't_2200',
    ];

    public function __construct(
        private readonly FederalHolidayCalendar $holidays,
    ) {}

    /**
     * @return array{
     *   holiday_rank: list<array{key: string, priority: string}>,
     *   desk_rank: list<array{key: string, priority: string}>,
     *   start_time_rank: list<array{key: string, priority: string}>,
     * }
     */
    public function condensedDefaults(): array
    {
        return [
            'holiday_rank' => $this->defaultKeyedRank(array_keys(self::HOLIDAY_GROUPS)),
            'desk_rank' => $this->defaultKeyedRank(self::DESK_KEYS),
            'start_time_rank' => $this->defaultKeyedRank(self::START_TIME_KEYS),
        ];
    }

    /**
     * @param  array<string, mixed>  $profile
     * @return array<string, mixed>
     */
    public function expandProfile(BidImport $import, array $profile): array
    {
        $bidYear = (int) $import->bid_year;
        $deskKeys = app(BidLinePreferenceCatalog::class)->deskKeysForImport($import->id);
        $startKeys = app(BidLinePreferenceCatalog::class)->startTimeKeysForImport($import->id);

        $condensedDefaults = $this->condensedDefaults();

        return [
            'holiday_rank' => $this->expandHolidayRank(
                $profile['holiday_rank'] ?? $condensedDefaults['holiday_rank'],
                $bidYear,
            ),
            'desk_rank' => $this->expandDeskRank(
                $profile['desk_rank'] ?? $condensedDefaults['desk_rank'],
                $deskKeys,
            ),
            'start_time_rank' => $this->expandStartTimeRank(
                $profile['start_time_rank'] ?? $condensedDefaults['start_time_rank'],
                $startKeys,
            ),
        ];
    }

    /**
     * @return array{
     *   holiday_rank: list<array{key: string, priority: string}>,
     *   desk_rank: list<array{key: string, priority: string}>,
     *   start_time_rank: list<array{key: string, priority: string}>,
     * }
     */
    public function toCondensedPayload(BidScenario $scenario): array
    {
        $scenario->loadMissing('import');
        $bidYear = (int) $scenario->import->bid_year;

        return [
            'holiday_rank' => $this->toCondensedHolidayRank($scenario->holiday_rank ?? [], $bidYear),
            'desk_rank' => $this->toCondensedDeskRank($scenario->desk_rank ?? []),
            'start_time_rank' => $this->toCondensedStartTimeRank($scenario->start_time_rank ?? []),
        ];
    }

    /**
     * @param  list<array{key: string, priority?: string}>|mixed  $condensed
     * @return list<array{date: string, label: string, id: string, priority: string}>
     */
    public function expandHolidayRank(mixed $condensed, int $bidYear): array
    {
        $ordered = $this->normalizeKeyedRank($condensed, array_keys(self::HOLIDAY_GROUPS));
        $catalog = $this->holidays->holidaysInBidYear($bidYear);
        $out = [];
        $usedDates = [];

        foreach ($ordered as $entry) {
            $group = $entry['key'];
            $priority = $entry['priority'];
            $ids = self::HOLIDAY_GROUPS[$group] ?? [];

            foreach ($catalog as $date => $meta) {
                if (! in_array($meta['id'], $ids, true)) {
                    continue;
                }
                $out[] = [
                    'date' => $date,
                    'label' => $meta['label'],
                    'id' => $meta['id'],
                    'priority' => $priority,
                ];
                $usedDates[$date] = true;
            }
        }

        foreach ($catalog as $date => $meta) {
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
     * Mix desk lines follow XR preference (same rank slot).
     *
     * @param  list<array{key: string, priority?: string}>|mixed  $condensed
     * @param  list<string>  $importKeys
     * @return list<array{key: string, priority: string}>
     */
    public function expandDeskRank(mixed $condensed, array $importKeys): array
    {
        $ordered = $this->normalizeKeyedRank($condensed, self::DESK_KEYS);
        $out = [];
        $seen = [];

        foreach ($ordered as $entry) {
            $key = strtoupper($entry['key']);
            $priority = $entry['priority'];

            if (in_array($key, $importKeys, true) && ! isset($seen[$key])) {
                $out[] = ['key' => $key, 'priority' => $priority];
                $seen[$key] = true;
            }

            if ($key === 'XR' && in_array('mix', $importKeys, true) && ! isset($seen['mix'])) {
                $out[] = ['key' => 'mix', 'priority' => $priority];
                $seen['mix'] = true;
            }
        }

        foreach ($importKeys as $key) {
            if (isset($seen[$key])) {
                continue;
            }
            $out[] = ['key' => $key, 'priority' => 'ignore'];
        }

        return $out;
    }

    /**
     * @param  list<array{key: string, priority?: string}>|mixed  $condensed
     * @param  list<string>  $importKeys
     * @return list<array{key: string, priority: string}>
     */
    public function expandStartTimeRank(mixed $condensed, array $importKeys): array
    {
        $ordered = $this->normalizeKeyedRank($condensed, self::START_TIME_KEYS);
        $out = [];
        $seen = [];

        foreach ($ordered as $entry) {
            $hourKey = $entry['key'];
            $priority = $entry['priority'];
            $rankKey = self::START_TIME_RANK_KEY_MAP[$hourKey] ?? null;

            if ($rankKey === null) {
                continue;
            }

            $matches = $this->importKeysForHour($rankKey, $importKeys);
            foreach ($matches as $matchKey) {
                if (isset($seen[$matchKey])) {
                    continue;
                }
                $out[] = ['key' => $matchKey, 'priority' => $priority];
                $seen[$matchKey] = true;
            }
        }

        foreach ($importKeys as $key) {
            if (isset($seen[$key])) {
                continue;
            }
            $out[] = ['key' => $key, 'priority' => 'ignore'];
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $full
     * @return list<array{key: string, priority: string}>
     */
    public function toCondensedHolidayRank(array $full, int $bidYear): array
    {
        $byId = [];
        foreach ($full as $row) {
            if (! is_array($row) || empty($row['id'])) {
                continue;
            }
            $byId[$row['id']] = $row['priority'] ?? 'high';
        }

        $out = [];
        foreach (array_keys(self::HOLIDAY_GROUPS) as $group) {
            $priorities = [];
            foreach (self::HOLIDAY_GROUPS[$group] as $id) {
                if (isset($byId[$id])) {
                    $priorities[] = $byId[$id];
                }
            }
            $out[] = [
                'key' => $group,
                'priority' => $this->dominantPriority($priorities) ?? 'high',
            ];
        }

        return $out === [] ? $this->defaultKeyedRank(array_keys(self::HOLIDAY_GROUPS)) : $out;
    }

    /**
     * @param  list<array<string, mixed>>  $full
     * @return list<array{key: string, priority: string}>
     */
    public function toCondensedDeskRank(array $full): array
    {
        $byKey = [];
        foreach ($full as $row) {
            if (! is_array($row) || empty($row['key'])) {
                continue;
            }
            $byKey[$row['key']] = $row['priority'] ?? 'high';
        }

        $out = [];
        foreach (self::DESK_KEYS as $deskKey) {
            $priority = $byKey[$deskKey] ?? ($deskKey === 'XR' ? ($byKey['mix'] ?? 'high') : 'high');
            $out[] = ['key' => $deskKey, 'priority' => $priority];
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $full
     * @return list<array{key: string, priority: string}>
     */
    public function toCondensedStartTimeRank(array $full): array
    {
        $byRankKey = [];
        foreach ($full as $row) {
            if (! is_array($row) || empty($row['key'])) {
                continue;
            }
            $byRankKey[$row['key']] = $row['priority'] ?? 'high';
        }

        $out = [];
        foreach (self::START_TIME_KEYS as $hourKey) {
            $rankKey = self::START_TIME_RANK_KEY_MAP[$hourKey];
            $priority = $byRankKey[$rankKey]
                ?? $byRankKey[str_replace('t_0', 't_', $rankKey)]
                ?? 'high';
            $out[] = ['key' => $hourKey, 'priority' => $priority];
        }

        return $out;
    }

    /**
     * @param  list<string>  $keys
     * @return list<array{key: string, priority: string}>
     */
    private function defaultKeyedRank(array $keys): array
    {
        return array_map(
            fn (string $key) => ['key' => $key, 'priority' => 'high'],
            $keys,
        );
    }

    /**
     * @param  mixed  $raw
     * @param  list<string>  $defaultKeys
     * @return list<array{key: string, priority: string}>
     */
    private function normalizeKeyedRank(mixed $raw, array $defaultKeys): array
    {
        if (! is_array($raw) || $raw === []) {
            return $this->defaultKeyedRank($defaultKeys);
        }

        $out = [];
        $seen = [];
        foreach ($raw as $row) {
            if (! is_array($row) || empty($row['key'])) {
                continue;
            }
            $key = (string) $row['key'];
            if (isset($seen[$key])) {
                continue;
            }
            $out[] = [
                'key' => $key,
                'priority' => in_array($row['priority'] ?? 'high', ['ignore', 'low', 'high'], true)
                    ? $row['priority']
                    : 'high',
            ];
            $seen[$key] = true;
        }

        foreach ($defaultKeys as $key) {
            if (! isset($seen[$key])) {
                $out[] = ['key' => $key, 'priority' => 'high'];
            }
        }

        return $out;
    }

    /**
     * @param  list<string>  $importKeys
     * @return list<string>
     */
    private function importKeysForHour(string $rankKey, array $importKeys): array
    {
        $matches = array_values(array_filter(
            $importKeys,
            fn (string $key) => $key === $rankKey || $key === str_replace('t_0', 't_', $rankKey),
        ));

        return $matches !== [] ? $matches : (in_array($rankKey, $importKeys, true) ? [$rankKey] : []);
    }

    /**
     * @param  list<string>  $priorities
     */
    private function dominantPriority(array $priorities): ?string
    {
        if ($priorities === []) {
            return null;
        }

        foreach (['high', 'low', 'ignore'] as $level) {
            if (in_array($level, $priorities, true)) {
                return $level;
            }
        }

        return $priorities[0];
    }
}
