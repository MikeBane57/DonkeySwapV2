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
            'training_dates' => $trainingDates,
            'notes' => $notes,
        ];
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
