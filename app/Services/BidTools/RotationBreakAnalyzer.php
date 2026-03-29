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
     *   training_dates: list<string>,
     *   notes: list<string>,
     * }
     */
    public function analyze(BidLine $line): array
    {
        $days = $line->days()->orderBy('assignment_date')->get();
        $offSeq = $days->map(fn ($d) => $d->is_off)->all();

        $runs = $this->offRunLengths($offSeq);
        $nonCanonical = array_values(array_filter($runs, fn (int $n) => $n > 0 && $n !== 3 && $n !== 5));

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
}
