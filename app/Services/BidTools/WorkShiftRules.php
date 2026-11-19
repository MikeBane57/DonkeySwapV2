<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

/**
 * SOD desk codes, per-day start times, shift length, and buddy overlap rules.
 */
final class WorkShiftRules
{
    public const WORK_MINUTES_STANDARD = 8 * 60 + 30;

    public const WORK_MINUTES_MID = 8 * 60;

    public const MAX_DOUBLE_OVERLAP_MINUTES = 30;

    public const CALENDAR_LEAD_MINUTES = 15;

    public const CALENDAR_END_EARLY_MINUTES = 30;

    public function hhmmToMinutes(string $hhmm): int
    {
        $hhmm = $this->normalizeHhmm($hhmm) ?? '0000';

        return ((int) substr($hhmm, 0, 2)) * 60 + (int) substr($hhmm, 2, 2);
    }

    public function normalizeHhmm(?string $raw): ?string
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }
        $digits = preg_replace('/\D/', '', trim($raw));
        if ($digits === null || strlen($digits) < 3) {
            return null;
        }
        $padded = substr(str_pad($digits, 4, '0', STR_PAD_LEFT), -4);
        $h = (int) substr($padded, 0, 2);
        $m = (int) substr($padded, 2, 2);
        if ($h > 23 || $m > 59) {
            return null;
        }

        return sprintf('%02d%02d', $h, $m);
    }

    public function isReliefWorkCode(?string $code): bool
    {
        if ($code === null) {
            return false;
        }
        $c = strtoupper(trim($code));
        if ($c === '') {
            return false;
        }

        return str_starts_with($c, 'RFS') || str_contains($c, 'RELIEF');
    }

    public function isNonWorkCalendarCode(?string $code): bool
    {
        if ($code === null) {
            return true;
        }
        $c = strtoupper(trim($code));
        if ($c === '') {
            return true;
        }

        return $c === 'DXX';
    }

    public function calendarDeskTitle(?string $dayCode, ?string $deskGroup): string
    {
        $raw = strtoupper(trim($dayCode ?: ($deskGroup ?? '')));
        if ($raw === '') {
            return 'Work';
        }
        if (preg_match('/^[AD][GRS]/', $raw)) {
            return substr($raw, 1);
        }

        return $raw;
    }

    public function workStartFromDayCode(
        ?string $dayCode,
        ?string $lineStart,
        ?string $deskGroup = null,
    ): ?string {
        if ($this->isNonWorkCalendarCode($dayCode)) {
            return null;
        }

        if ($this->isReliefWorkCode($dayCode)) {
            return null;
        }

        $c = strtoupper(trim((string) $dayCode));
        if ($c === '') {
            return $this->fallbackLineStart($lineStart, $deskGroup);
        }

        if (preg_match('/(\d+)$/', $c, $m)) {
            $deskNum = (int) $m[1];
            if ($deskNum === 5) {
                return '0700';
            }
            if ($deskNum === 6) {
                return '1500';
            }
        }

        if (str_starts_with($c, 'MG') || str_starts_with($c, 'MS')) {
            return '2200';
        }
        if (str_starts_with($c, 'DR')) {
            return '0700';
        }
        if (str_starts_with($c, 'AR')) {
            return '1500';
        }
        if (str_starts_with($c, 'DG') || str_starts_with($c, 'DS')) {
            return '0600';
        }
        if (str_starts_with($c, 'AG') || str_starts_with($c, 'AS')) {
            return '1400';
        }

        return $this->fallbackLineStart($lineStart, $deskGroup);
    }

    public function workDurationMinutes(?string $dayCode, ?string $workStart): int
    {
        $c = strtoupper(trim((string) $dayCode));
        if (str_starts_with($c, 'MG') || str_starts_with($c, 'MS')) {
            return self::WORK_MINUTES_MID;
        }

        $start = $this->normalizeHhmm($workStart);
        if ($start === '2200') {
            return self::WORK_MINUTES_MID;
        }

        return self::WORK_MINUTES_STANDARD;
    }

    /**
     * @return list<string>
     */
    public function lineStartCandidates(BidLine $line): array
    {
        $starts = [];
        $line->loadMissing('days');

        foreach ($line->days as $day) {
            if ($day->is_off) {
                continue;
            }
            $start = $this->workStartFromDayCode(
                $day->normalized_code,
                $line->start_time,
                $line->desk_group,
            );
            if ($start !== null) {
                $starts[$start] = true;
            }
        }

        if ($starts !== []) {
            return array_keys($starts);
        }

        foreach ($this->parseMixStartsFromLine((string) $line->start_time) as $start) {
            $starts[$start] = true;
        }

        $fallback = $this->fallbackLineStart($line->start_time, $line->desk_group);
        if ($fallback !== null) {
            $starts[$fallback] = true;
        }

        return array_keys($starts);
    }

    public function shiftsCanBuddyDouble(
        string $startA,
        int $durationA,
        string $startB,
        int $durationB,
    ): bool {
        return $this->overlapMinutes(
            $this->hhmmToMinutes($startA),
            $durationA,
            $this->hhmmToMinutes($startB),
            $durationB,
        ) <= self::MAX_DOUBLE_OVERLAP_MINUTES;
    }

    public function overlapMinutes(int $startA, int $durationA, int $startB, int $durationB): int
    {
        $endA = $startA + $durationA;
        $endB = $startB + $durationB;
        $overlapStart = max($startA, $startB);
        $overlapEnd = min($endA, $endB);

        return max(0, $overlapEnd - $overlapStart);
    }

    private function fallbackLineStart(?string $lineStart, ?string $deskGroup): ?string
    {
        $normalized = $this->normalizeHhmm($lineStart);
        if ($normalized !== null && $normalized !== '2200') {
            return $normalized;
        }

        $group = strtoupper(trim((string) $deskGroup));
        if ($normalized === '2200' || str_starts_with($group, 'M')) {
            return '2200';
        }

        return $normalized;
    }

    /**
     * @return list<string>
     */
    private function parseMixStartsFromLine(string $lineStart): array
    {
        $starts = [];
        if (preg_match_all('/\d{4}/', $lineStart, $matches)) {
            foreach ($matches[0] as $token) {
                $n = $this->normalizeHhmm($token);
                if ($n !== null) {
                    $starts[$n] = true;
                }
            }
        }

        return array_keys($starts);
    }
}
