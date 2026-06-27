<?php

namespace App\Services\BidTools;

use App\Models\BidLine;

final class RotationBreakAnalyzer
{
    private const TRAINING = ['TAM', 'TPM'];

    /**
     * @return array{
     *   off_run_lengths: list<int>,
     *   non_canonical_runs: list<int>,
     *   non_canonical_run_details: list<array{
     *     length: int,
     *     start_date: string,
     *     end_date: string,
     *     days: list<array{date: string, raw_cell: string, code: string|null}>
     *   }>,
     *   non_canonical_alerts: list<array{
     *     off_length: int,
     *     off_start_date: string,
     *     off_end_date: string,
     *     work_length: int,
     *     position: string,
     *     date: string,
     *     raw_cell: string,
     *     code: string|null
     *   }>,
     *   training_dates: list<string>,
     *   notes: list<string>,
     * }
     */
    public function analyze(BidLine $line): array
    {
        $days = $line->days()->orderBy('assignment_date')->get();
        $offSeq = $days->map(fn ($d) => $d->is_off)->all();
        $runs = $this->offRunLengths($offSeq);
        $runDetails = $this->offRunDetails($days->all());
        $nonCanonical = array_values(array_filter($runs, fn (int $n) => $n > 0 && $n !== 3 && $n !== 5));
        $nonCanonicalDetails = array_values(array_filter(
            $runDetails,
            fn (array $run) => $run['length'] !== 3 && $run['length'] !== 5,
        ));
        $scheduleRuns = $this->scheduleRuns($days->all());
        $alerts = $this->nonCanonicalAlerts($scheduleRuns);

        $trainingDates = [];
        foreach ($days as $d) {
            $code = $d->normalized_code;
            if ($code !== null && in_array($code, self::TRAINING, true)) {
                $trainingDates[] = $d->assignment_date->format('Y-m-d');
            }
        }

        $notes = [];
        if ($nonCanonical !== []) {
            $notes[] = 'Off-day runs with lengths other than 3 or 5: '.implode(', ', $nonCanonical).'.';
        }

        return [
            'off_run_lengths' => $runs,
            'non_canonical_runs' => $nonCanonical,
            'non_canonical_run_details' => $nonCanonicalDetails,
            'non_canonical_alerts' => $alerts,
            'training_dates' => $trainingDates,
            'notes' => $notes,
        ];
    }

    private static function isCanonicalRunLength(int $length): bool
    {
        return $length === 3 || $length === 5;
    }

    /**
     * @param  list<\App\Models\BidLineDay>  $days
     * @return list<array{
     *   type: string,
     *   length: int,
     *   start_date: string,
     *   end_date: string,
     *   days: list<array{date: string, raw_cell: string, code: string|null}>
     * }>
     */
    private function scheduleRuns(array $days): array
    {
        $runs = [];
        $current = null;

        foreach ($days as $day) {
            $type = $day->is_off ? 'off' : 'work';
            $entry = [
                'date' => $day->assignment_date->format('Y-m-d'),
                'raw_cell' => (string) $day->raw_cell,
                'code' => $day->normalized_code,
            ];

            if ($current === null || $current['type'] !== $type) {
                if ($current !== null) {
                    $runs[] = $this->finalizeScheduleRun($current);
                }
                $current = ['type' => $type, 'length' => 0, 'days' => []];
            }

            $current['length']++;
            $current['days'][] = $entry;
        }

        if ($current !== null) {
            $runs[] = $this->finalizeScheduleRun($current);
        }

        return $runs;
    }

    /**
     * @param  array{type: string, length: int, days: list<array{date: string, raw_cell: string, code: string|null}>}  $run
     * @return array{
     *   type: string,
     *   length: int,
     *   start_date: string,
     *   end_date: string,
     *   days: list<array{date: string, raw_cell: string, code: string|null}>
     * }
     */
    private function finalizeScheduleRun(array $run): array
    {
        $first = $run['days'][0]['date'];
        $last = $run['days'][count($run['days']) - 1]['date'];

        return [
            'type' => $run['type'],
            'length' => $run['length'],
            'start_date' => $first,
            'end_date' => $last,
            'days' => $run['days'],
        ];
    }

    /**
     * @param  list<array{
     *   type: string,
     *   length: int,
     *   start_date: string,
     *   end_date: string,
     *   days: list<array{date: string, raw_cell: string, code: string|null}>
     * }>  $scheduleRuns
     * @return list<array{
     *   off_length: int,
     *   off_start_date: string,
     *   off_end_date: string,
     *   work_length: int,
     *   position: string,
     *   date: string,
     *   raw_cell: string,
     *   code: string|null
     * }>
     */
    private function nonCanonicalAlerts(array $scheduleRuns): array
    {
        $alerts = [];

        foreach ($scheduleRuns as $index => $run) {
            if ($run['type'] !== 'off' || self::isCanonicalRunLength($run['length'])) {
                continue;
            }

            $neighborIndex = $index + 1;
            $neighbor = $scheduleRuns[$neighborIndex] ?? null;
            if ($neighbor === null || $neighbor['type'] !== 'work') {
                continue;
            }
            if (self::isCanonicalRunLength($neighbor['length'])) {
                continue;
            }

            $firstWorkDay = $neighbor['days'][0];
            $alerts[] = [
                'off_length' => $run['length'],
                'off_start_date' => $run['start_date'],
                'off_end_date' => $run['end_date'],
                'work_length' => $neighbor['length'],
                'position' => 'after',
                'date' => $firstWorkDay['date'],
                'raw_cell' => $firstWorkDay['raw_cell'],
                'code' => $firstWorkDay['code'],
            ];
        }

        return $alerts;
    }

    /**
     * @param  list<bool>  $offSequence
     * @return list<int>
     */
    private function offRunLengths(array $offSequence): array
    {
        $runs = [];
        $n = count($offSequence);
        $i = 0;
        while ($i < $n) {
            if (! $offSequence[$i]) {
                $i++;

                continue;
            }
            $len = 0;
            while ($i < $n && $offSequence[$i]) {
                $len++;
                $i++;
            }
            $runs[] = $len;
        }

        return $runs;
    }

    /**
     * @param  list<\App\Models\BidLineDay>  $days
     * @return list<array{
     *   length: int,
     *   start_date: string,
     *   end_date: string,
     *   days: list<array{date: string, raw_cell: string, code: string|null}>
     * }>
     */
    private function offRunDetails(array $days): array
    {
        $runs = [];
        $current = null;

        foreach ($days as $day) {
            if ($day->is_off) {
                if ($current === null) {
                    $current = ['length' => 0, 'days' => []];
                }
                $current['length']++;
                $current['days'][] = [
                    'date' => $day->assignment_date->format('Y-m-d'),
                    'raw_cell' => (string) $day->raw_cell,
                    'code' => $day->normalized_code,
                ];
            } elseif ($current !== null) {
                $runs[] = $this->finalizeRun($current);
                $current = null;
            }
        }

        if ($current !== null) {
            $runs[] = $this->finalizeRun($current);
        }

        return $runs;
    }

    /**
     * @param  array{length: int, days: list<array{date: string, raw_cell: string, code: string|null}>}  $run
     * @return array{
     *   length: int,
     *   start_date: string,
     *   end_date: string,
     *   days: list<array{date: string, raw_cell: string, code: string|null}>
     * }
     */
    private function finalizeRun(array $run): array
    {
        $first = $run['days'][0]['date'];
        $last = $run['days'][count($run['days']) - 1]['date'];

        return [
            'length' => $run['length'],
            'start_date' => $first,
            'end_date' => $last,
            'days' => $run['days'],
        ];
    }
}
