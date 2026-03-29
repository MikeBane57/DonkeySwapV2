<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

final class DominantDeskAnalyzer
{
    /**
     * @return array{
     *   dominant_code: string|null,
     *   frequencies: array<string, int>,
     *   group_bucket: string,
     * }
     */
    public function analyze(BidLine $line): array
    {
        $line->loadMissing('days');
        $freq = [];
        foreach ($line->days as $d) {
            if ($d->is_off || $d->normalized_code === null) {
                continue;
            }
            $c = $d->normalized_code;
            $freq[$c] = ($freq[$c] ?? 0) + 1;
        }

        arsort($freq);
        $dominant = $freq === [] ? null : array_key_first($freq);

        return [
            'dominant_code' => $dominant,
            'frequencies' => $freq,
            'group_bucket' => $this->groupBucket($line->desk_group),
        ];
    }

    public function groupBucket(string $group): string
    {
        $g = strtoupper(trim($group));
        if ($g === '') {
            return 'unknown';
        }
        if (str_contains($g, 'MIX') || str_contains($g, '/')) {
            return 'mix';
        }
        if (str_starts_with($g, 'MG') || str_starts_with($g, 'MS')) {
            return 'mg_ms';
        }

        return $g;
    }
}
