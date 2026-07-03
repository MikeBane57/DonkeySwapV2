<?php

namespace App\Services\BidTools;

final class StartTimeNormalizer
{
    /**
     * Stable key for ranking / comparison.
     */
    public function rankKey(string $startTime): string
    {
        $s = trim($startTime);
        if ($s === '') {
            return 'unknown';
        }

        $fourDigit = $this->normalizeFourDigit($s);
        if ($fourDigit !== null) {
            return 't_'.$fourDigit;
        }

        $u = strtoupper($s);

        if (preg_match('/\bAM-MIX\b/i', $s) && preg_match_all('/\d{4}/', $s, $m)) {
            return 'am_mix_'.implode('_', $m[0]);
        }
        if (preg_match('/\bPM-MIX\b/i', $s)) {
            return 'pm_mix';
        }
        if (preg_match('/\bMID-MIX\b/i', $s)) {
            return 'mid_mix';
        }
        if (str_contains($u, 'AM') && ! str_contains($u, 'MIX')) {
            return 'am';
        }
        if (str_contains($u, 'PM') && ! str_contains($u, 'MIX')) {
            return 'pm';
        }
        if (str_contains($u, 'MID')) {
            return 'mid';
        }

        return 'raw_'.md5($s);
    }

    public function matchesStartTime(string $lineStart, string $mappingStart): bool
    {
        return $this->rankKey($lineStart) === $this->rankKey($mappingStart);
    }

    private function normalizeFourDigit(string $startTime): ?string
    {
        $s = trim($startTime);
        if (preg_match('/^(\d{1,2}):(\d{2})$/', $s, $matches)) {
            return str_pad($matches[1], 2, '0', STR_PAD_LEFT).str_pad($matches[2], 2, '0', STR_PAD_LEFT);
        }

        if (preg_match('/^\d{3,4}$/', $s)) {
            return str_pad($s, 4, '0', STR_PAD_LEFT);
        }

        return null;
    }

    public function displayLabel(string $startTime): string
    {
        return trim($startTime) ?: '—';
    }
}
