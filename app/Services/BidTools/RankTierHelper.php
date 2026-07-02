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
     * Group consecutive entries with the same normalized tier (matches editor list layout).
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
     * Groups keyed by assigned tier, sorted low-to-high (G1, G2, G3…).
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<list<array<string, mixed>>>
     */
    public static function entriesToAssignedTierGroups(array $entries): array
    {
        $normalized = self::normalizeTierOrder($entries);
        $byTier = [];

        foreach ($normalized as $entry) {
            $tier = (int) ($entry['tier'] ?? 1);
            $byTier[$tier][] = $entry;
        }

        ksort($byTier);

        return array_values($byTier);
    }

    /**
     * Renumber tiers to 1..N from consecutive groups in list order (matches editor G1, G2…).
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<array<string, mixed>>
     */
    public static function syncTiersFromVisualGroups(array $entries): array
    {
        if ($entries === []) {
            return [];
        }

        $groups = self::entriesToTierGroups(self::normalizeTierOrder($entries));
        $out = [];

        foreach ($groups as $groupIndex => $group) {
            $tier = $groupIndex + 1;
            foreach ($group as $entry) {
                $out[] = array_merge($entry, ['tier' => $tier]);
            }
        }

        return $out;
    }

    /**
     * 1-based visual group label (G1, G2…) from consecutive list groups in the editor.
     *
     * @param  list<array<string, mixed>>  $entries
     */
    public static function tierGroupIndexForKey(array $entries, string $lineKey, ?callable $normalizeKey = null): int
    {
        $normalize = $normalizeKey ?? static fn (string $key): string => strtoupper(trim($key));
        $needle = $normalize($lineKey);
        $groups = self::entriesToTierGroups(self::normalizeTierOrder($entries));
        $worst = count($groups) + 1;

        foreach ($groups as $groupIndex => $group) {
            foreach ($group as $entry) {
                $key = $normalize((string) ($entry['key'] ?? ''));
                if ($key !== $needle) {
                    continue;
                }

                if (($entry['priority'] ?? 'high') === 'ignore') {
                    return $worst;
                }

                return $groupIndex + 1;
            }
        }

        return $worst;
    }

    /**
     * Sort desk entries by assigned tier, preserving prior list order within a tier.
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<array<string, mixed>>
     */
    public static function sortEntriesByTierListOrder(array $entries): array
    {
        if ($entries === []) {
            return [];
        }

        $normalized = self::normalizeTierOrder($entries);
        $rows = [];

        foreach ($normalized as $index => $entry) {
            $rows[] = [
                'entry' => $entry,
                'index' => $index,
            ];
        }

        usort(
            $rows,
            fn (array $a, array $b): int => ((int) ($a['entry']['tier'] ?? 1)) <=> ((int) ($b['entry']['tier'] ?? 1))
                ?: $a['index'] <=> $b['index'],
        );

        return array_map(fn (array $row): array => $row['entry'], $rows);
    }

    /**
     * Pull same-tier rows into the first list block for that tier (e.g. DS7 at end → G2).
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<array<string, mixed>>
     */
    public static function mergeNonContiguousTierBlocks(array $entries): array
    {
        if ($entries === []) {
            return [];
        }

        $work = self::normalizeTierOrder($entries);
        $indicesByTier = [];

        foreach ($work as $index => $entry) {
            $tier = (int) ($entry['tier'] ?? 1);
            $indicesByTier[$tier][] = $index;
        }

        foreach ($indicesByTier as $tier => $indices) {
            if (count($indices) <= 1) {
                continue;
            }

            $firstRunEnd = $indices[0];
            for ($offset = 1; $offset < count($indices); $offset++) {
                if ($indices[$offset] === $firstRunEnd + 1) {
                    $firstRunEnd = $indices[$offset];

                    continue;
                }

                break;
            }

            $orphanKeys = [];
            foreach ($indices as $index) {
                if ($index > $firstRunEnd) {
                    $orphanKeys[] = (string) ($work[$index]['key'] ?? '');
                }
            }

            if ($orphanKeys === []) {
                continue;
            }

            $orphans = [];
            $without = [];
            foreach ($work as $entry) {
                $key = (string) ($entry['key'] ?? '');
                if ((int) ($entry['tier'] ?? 1) === $tier && in_array($key, $orphanKeys, true)) {
                    $orphans[] = $entry;

                    continue;
                }

                $without[] = $entry;
            }

            $anchorKey = (string) ($work[$firstRunEnd]['key'] ?? '');
            $insertAt = count($without);
            foreach ($without as $index => $entry) {
                if ((string) ($entry['key'] ?? '') === $anchorKey) {
                    $insertAt = $index + 1;

                    break;
                }
            }

            array_splice($without, $insertAt, 0, $orphans);
            $work = $without;
        }

        return $work;
    }

    /**
     * Move entries that share a tier into one contiguous block, then renumber visual groups.
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<array<string, mixed>>
     */
    public static function prepareDeskRankEntries(array $entries): array
    {
        if ($entries === []) {
            return [];
        }

        return self::syncTiersFromVisualGroups(
            self::mergeNonContiguousTierBlocks($entries),
        );
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
        return self::tierGroupIndexForKey($entries, $lineKey, $normalizeKey);
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
