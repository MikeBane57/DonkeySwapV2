<?php

namespace App\Services\BidTools;

final class ManualLineOrderService
{
    /**
     * @param  list<array<string, mixed>>  $scored
     * @param  list<int>|null  $manualLineOrder
     * @return list<array<string, mixed>>
     */
    public function apply(array $scored, ?array $manualLineOrder): array
    {
        if ($manualLineOrder === null || $manualLineOrder === []) {
            return $scored;
        }

        $byId = [];
        foreach ($scored as $row) {
            $byId[(int) $row['bid_line_id']] = $row;
        }

        $ordered = [];
        $seen = [];

        foreach ($manualLineOrder as $lineId) {
            $lineId = (int) $lineId;
            if (isset($byId[$lineId]) && ! isset($seen[$lineId])) {
                $ordered[] = $byId[$lineId];
                $seen[$lineId] = true;
            }
        }

        foreach ($scored as $row) {
            $lineId = (int) $row['bid_line_id'];
            if (! isset($seen[$lineId])) {
                $ordered[] = $row;
                $seen[$lineId] = true;
            }
        }

        return $ordered;
    }

    /**
     * @param  list<int>  $lineOrder
     * @param  list<int>  $validLineIds
     * @return list<int>|null
     */
    public function normalize(?array $lineOrder, array $validLineIds): ?array
    {
        if ($lineOrder === null || $lineOrder === []) {
            return null;
        }

        $valid = array_fill_keys($validLineIds, true);
        $normalized = [];
        $seen = [];

        foreach ($lineOrder as $lineId) {
            $lineId = (int) $lineId;
            if (isset($valid[$lineId]) && ! isset($seen[$lineId])) {
                $normalized[] = $lineId;
                $seen[$lineId] = true;
            }
        }

        return $normalized === [] ? null : $normalized;
    }
}
