<?php

namespace App\Services\BidTools;

/**
 * Normalizes rank-list tiers so entries in the same tier score equally.
 */
final class RankTierHelper
{
    /**
     * @param  list<array<string, mixed>>  $entries
     * @return list<array<string, mixed>>
     */
    public static function normalizeTierOrder(array $entries): array
    {
        if ($entries === []) {
            return [];
        }

        $rawTiers = [];
        foreach ($entries as $i => $entry) {
            $rawTiers[] = isset($entry['tier']) ? (int) $entry['tier'] : ($i + 1);
        }

        $unique = array_values(array_unique($rawTiers));
        sort($unique);
        $tierMap = [];
        foreach ($unique as $i => $raw) {
            $tierMap[$raw] = $i + 1;
        }

        $out = [];
        foreach ($entries as $i => $entry) {
            $rawTier = isset($entry['tier']) ? (int) $entry['tier'] : ($i + 1);
            $out[] = array_merge($entry, ['tier' => $tierMap[$rawTier]]);
        }

        return $out;
    }

    /**
     * Group consecutive entries with the same normalized tier (matches editor G1/G2…).
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<list<array<string, mixed>>>
     */
    public static function entriesToTierGroups(array $entries): array
    {
        $normalized = self::normalizeTierOrder($entries);
        $groups = [];

        foreach ($normalized as $entry) {
            $tier = (int) ($entry['tier'] ?? 1);
            $last = $groups === [] ? null : $groups[array_key_last($groups)];
            if ($last !== null && (int) ($last[0]['tier'] ?? 0) === $tier) {
                $groups[array_key_last($groups)][] = $entry;
            } else {
                $groups[] = [$entry];
            }
        }

        return $groups;
    }

    /**
     * 1-based editor group index (G1, G2…) for a key in list order.
     *
     * @param  list<array<string, mixed>>  $entries
     */
    public static function tierGroupIndexForKey(array $entries, string $lineKey, ?callable $normalizeKey = null): int
    {
        $normalize = $normalizeKey ?? static fn (string $key): string => strtoupper(trim($key));
        $needle = $normalize($lineKey);
        $groups = self::entriesToTierGroups($entries);

        foreach ($groups as $index => $group) {
            foreach ($group as $entry) {
                $key = $normalize((string) ($entry['key'] ?? ''));
                if ($key === $needle) {
                    return $index + 1;
                }
            }
        }

        return count($groups) + 1;
    }

    /**
     * @param  list<array<string, mixed>>  $entries
     * @return list<int>
     */
    public static function orderedTiers(array $entries): array
    {
        $normalized = self::normalizeTierOrder($entries);
        $tiers = [];
        foreach ($normalized as $entry) {
            $tier = (int) ($entry['tier'] ?? 1);
            if (! in_array($tier, $tiers, true)) {
                $tiers[] = $tier;
            }
        }

        return $tiers;
    }

    /**
     * @param  list<array<string, mixed>>  $entries
     */
    public static function tierWeight(array $entries, int $entryIndex): int
    {
        $normalized = self::normalizeTierOrder($entries);
        $tiers = self::orderedTiers($normalized);
        $tierCount = count($tiers);
        if ($tierCount === 0 || ! isset($normalized[$entryIndex])) {
            return 1;
        }

        $entryTier = (int) ($normalized[$entryIndex]['tier'] ?? 1);
        $tierIndex = array_search($entryTier, $tiers, true);
        if ($tierIndex === false) {
            return 1;
        }

        return max(1, $tierCount - $tierIndex);
    }

    /**
     * @param  list<array<string, mixed>>  $entries
     */
    public static function tierRankForKey(array $entries, string $lineKey, ?callable $normalizeKey = null): int
    {
        $normalize = $normalizeKey ?? static fn (string $key): string => strtoupper(trim($key));
        $normalized = self::normalizeTierOrder($entries);
        $worst = count(self::orderedTiers($normalized)) + 1;
        $needle = $normalize($lineKey);

        foreach ($normalized as $entry) {
            $key = $normalize((string) ($entry['key'] ?? ''));
            if ($key !== $needle) {
                continue;
            }

            if (($entry['priority'] ?? 'high') === 'ignore') {
                return $worst;
            }

            return (int) ($entry['tier'] ?? $worst);
        }

        return $worst;
    }

    /**
     * 1-based list position for a key in a ranked list (ties share the first index).
     *
     * @param  list<array<string, mixed>>  $entries
     */
    public static function listRankForKey(array $entries, string $lineKey, ?callable $normalizeKey = null): int
    {
        $normalize = $normalizeKey ?? static fn (string $key): string => strtoupper(trim($key));
        $normalized = self::normalizeTierOrder($entries);
        $worst = count($normalized) + 1;
        $needle = $normalize($lineKey);

        foreach ($normalized as $i => $entry) {
            $key = $normalize((string) ($entry['key'] ?? ''));
            if ($key !== $needle) {
                continue;
            }

            if (($entry['priority'] ?? 'high') === 'ignore') {
                return $worst;
            }

            return $i + 1;
        }

        return $worst;
    }
}
