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
        'july_4' => ['july_4'],
        'super_bowl' => ['super_bowl_sunday'],
        'new_years' => ['new_years_eve', 'new_years_day'],
    ];

    /** @var list<array{key: string, priority: string, tier: int}> */
    private const DEFAULT_CONDENSED_HOLIDAY_RANK = [
        ['key' => 'christmas', 'priority' => 'high', 'tier' => 1],
        ['key' => 'thanksgiving', 'priority' => 'high', 'tier' => 2],
        ['key' => 'july_4', 'priority' => 'high', 'tier' => 3],
        ['key' => 'super_bowl', 'priority' => 'high', 'tier' => 4],
        ['key' => 'new_years', 'priority' => 'ignore', 'tier' => 5],
    ];

    /** @var list<string> */
    public const DESK_KEYS = CondensedDeskClassifier::BUCKETS;

    public function __construct(
        private readonly FederalHolidayCalendar $holidays,
    ) {}

    /**
     * @return array{
     *   holiday_rank: list<array{key: string, priority: string}>,
     *   desk_rank: list<array{key: string, priority: string}>,
     * }
     */
    public function condensedDefaults(): array
    {
        return [
            'holiday_rank' => $this->defaultHolidayRank(),
            'desk_rank' => $this->defaultKeyedRank(self::DESK_KEYS),
        ];
    }

    /**
     * @param  array<string, mixed>  $profile
     * @return array<string, mixed>
     */
    public function expandProfile(BidImport $import, array $profile): array
    {
        $bidYear = (int) $import->bid_year;
        $deskKeys = app(CondensedDeskClassifier::class)->bucketsPresentInImport($import->id);

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
        ];
    }

    /**
     * @return array{
     *   holiday_rank: list<array{key: string, priority: string}>,
     *   desk_rank: list<array{key: string, priority: string}>,
     * }
     */
    public function toCondensedPayload(BidScenario $scenario): array
    {
        $scenario->loadMissing('import');
        $bidYear = (int) $scenario->import->bid_year;

        return [
            'holiday_rank' => $this->toCondensedHolidayRank($scenario->holiday_rank ?? [], $bidYear),
            'desk_rank' => $this->toCondensedDeskRank($scenario->desk_rank ?? []),
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
                $row = ['key' => $key, 'priority' => $priority];
                if (isset($entry['tier'])) {
                    $row['tier'] = (int) $entry['tier'];
                }
                $out[] = $row;
                $seen[$key] = true;
            }
        }

        foreach ($importKeys as $key) {
            if (isset($seen[$key])) {
                continue;
            }
            $out[] = ['key' => $key, 'priority' => 'ignore'];
        }

        return RankTierHelper::prepareDeskRankEntries($out);
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

        return $out === [] ? $this->defaultHolidayRank() : $out;
    }

    /**
     * @return list<array{key: string, priority: string, tier: int}>
     */
    public function defaultHolidayRank(): array
    {
        return self::DEFAULT_CONDENSED_HOLIDAY_RANK;
    }

    /**
     * @param  list<array<string, mixed>>  $full
     * @return list<array{key: string, priority: string, tier?: int}>
     */
    public function toCondensedDeskRank(array $full): array
    {
        if ($full === []) {
            return $this->defaultKeyedRank(self::DESK_KEYS);
        }

        $seen = [];
        $out = [];
        foreach ($full as $row) {
            if (! is_array($row) || empty($row['key'])) {
                continue;
            }
            $key = strtoupper((string) $row['key']);
            if (isset($seen[$key])) {
                continue;
            }
            $entry = [
                'key' => $key,
                'priority' => in_array($row['priority'] ?? 'high', ['ignore', 'low', 'high'], true)
                    ? $row['priority']
                    : 'high',
            ];
            if (isset($row['tier']) && is_numeric($row['tier'])) {
                $entry['tier'] = max(1, (int) $row['tier']);
            }
            $out[] = $entry;
            $seen[$key] = true;
        }

        foreach (self::DESK_KEYS as $deskKey) {
            if (isset($seen[$deskKey])) {
                continue;
            }
            $out[] = ['key' => $deskKey, 'priority' => 'high'];
        }

        return RankTierHelper::prepareDeskRankEntries($out);
    }

    /**
     * @param  list<string>  $keys
     * @return list<array{key: string, priority: string}>
     */
    private function defaultKeyedRank(array $keys): array
    {
        return array_map(
            fn (string $key, int $index) => ['key' => $key, 'priority' => 'high', 'tier' => $index + 1],
            $keys,
            array_keys($keys),
        );
    }

    /**
     * @param  list<string>  $defaultKeys
     * @return list<array{key: string, priority: string}>
     */
    private function normalizeKeyedRank(mixed $raw, array $defaultKeys): array
    {
        if (! is_array($raw) || $raw === []) {
            return $defaultKeys === array_keys(self::HOLIDAY_GROUPS)
                ? $this->defaultHolidayRank()
                : $this->defaultKeyedRank($defaultKeys);
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
            $entry = [
                'key' => $key,
                'priority' => in_array($row['priority'] ?? 'high', ['ignore', 'low', 'high'], true)
                    ? $row['priority']
                    : 'high',
            ];
            if (isset($row['tier']) && is_numeric($row['tier'])) {
                $entry['tier'] = max(1, (int) $row['tier']);
            }
            $out[] = $entry;
            $seen[$key] = true;
        }

        foreach ($defaultKeys as $key) {
            if (! isset($seen[$key])) {
                $out[] = ['key' => $key, 'priority' => 'high', 'tier' => count($out) + 1];
            }
        }

        return RankTierHelper::normalizeTierOrder($out);
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
