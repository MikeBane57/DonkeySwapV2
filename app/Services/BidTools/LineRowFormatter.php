<?php

namespace App\Services\BidTools;

use App\Models\BidLine;
use Carbon\CarbonImmutable;

final class LineRowFormatter
{
    public function __construct(
        private readonly LineMetricsService $lineMetrics,
        private readonly RotationBreakAnalyzer $rotationBreaks,
    ) {}

    /**
     * @return array{
     *   id: int,
     *   line_num: string,
     *   desk_group: string,
     *   source_label: string|null,
     *   start_time: string,
     *   rotation: string|null,
     *   workdays_from_file: int|null,
     *   workdays_computed: int,
     *   metrics: array,
     *   rotation_analysis: array,
     *   training_summary: string,
     *   schedule_callouts: string,
     * }
     */
    public function format(BidLine $line): array
    {
        $line->load(['days', 'import']);
        $bidYear = (int) ($line->import?->bid_year ?? 0);

        $reliefDates = [];
        $trainingSlots = [];
        foreach ($line->days as $d) {
            $c = $d->normalized_code;
            $date = CarbonImmutable::parse($d->assignment_date)->startOfDay();
            if (! $d->is_off && $c !== null && stripos($c, 'RELIEF') !== false) {
                $reliefDates[] = $date;
            }
            if ($c === 'TAM' || $c === 'TPM') {
                $season = $bidYear > 0 ? $this->seasonForBidDate($date, $bidYear) : null;
                if ($season !== null) {
                    $trainingSlots[] = [
                        'season' => $season,
                        'code' => $c,
                        'date' => $date,
                    ];
                }
            }
        }

        $metrics = $this->lineMetrics->analyze($line);
        $rotation = $this->rotationBreaks->analyze($line);
        $trainingSummary = $this->formatTrainingSummary($trainingSlots);
        $callouts = $this->buildScheduleCallouts($rotation, $reliefDates);

        return [
            'id' => $line->id,
            'line_num' => $line->line_num,
            'desk_group' => $line->desk_group,
            'source_label' => $line->source_label,
            'start_time' => $line->start_time,
            'rotation' => $line->rotation,
            'workdays_from_file' => $line->workdays_from_file,
            'workdays_computed' => $line->workdays_computed,
            'metrics' => $metrics,
            'rotation_analysis' => $rotation,
            'training_summary' => $trainingSummary,
            'schedule_callouts' => $callouts,
        ];
    }

    /**
     * @param  list<array{season: string, code: string, date: CarbonImmutable}>  $slots
     */
    private function formatTrainingSummary(array $slots): string
    {
        if ($slots === []) {
            return '—';
        }

        /** @var array<string, list<CarbonImmutable>> $grouped */
        $grouped = [];
        foreach ($slots as $slot) {
            $k = $slot['season'].':'.$slot['code'];
            $grouped[$k] ??= [];
            $grouped[$k][] = $slot['date'];
        }

        $rows = [];
        foreach ($grouped as $key => $dates) {
            [$season, $code] = explode(':', $key, 2);
            $unique = [];
            foreach ($dates as $dt) {
                $unique[$dt->format('Y-m-d')] = $dt;
            }
            $sorted = array_values($unique);
            usort($sorted, fn (CarbonImmutable $a, CarbonImmutable $b): int => $a->timestamp <=> $b->timestamp);
            $rows[] = ['season' => $season, 'code' => $code, 'dates' => $sorted];
        }

        usort($rows, function (array $a, array $b): int {
            $seasonOrder = ['spring' => 0, 'fall' => 1];
            $sa = $seasonOrder[$a['season']] ?? 99;
            $sb = $seasonOrder[$b['season']] ?? 99;
            if ($sa !== $sb) {
                return $sa <=> $sb;
            }
            $codeOrder = ['TAM' => 0, 'TPM' => 1];
            $ca = $codeOrder[$a['code']] ?? 99;
            $cb = $codeOrder[$b['code']] ?? 99;
            if ($ca !== $cb) {
                return $ca <=> $cb;
            }

            $t1 = isset($a['dates'][0]) ? $a['dates'][0]->timestamp : 0;
            $t2 = isset($b['dates'][0]) ? $b['dates'][0]->timestamp : 0;

            return $t1 <=> $t2;
        });

        $parts = [];
        foreach ($rows as $row) {
            $abbr = $row['season'] === 'spring' ? 'SP' : 'FA';
            $dateStr = implode(', ', array_map(
                fn (CarbonImmutable $d) => $d->format('n/j/y'),
                $row['dates']
            ));
            $parts[] = $abbr.' ('.$row['code'].') '.$dateStr;
        }

        return implode(' · ', $parts);
    }

    private function seasonForBidDate(CarbonImmutable $d, int $bidYear): ?string
    {
        $start = CarbonImmutable::create($bidYear, 2, 1)->startOfDay();
        $end = CarbonImmutable::create($bidYear + 1, 1, 31)->endOfDay();
        if ($d->lt($start) || $d->gt($end)) {
            return null;
        }
        $springEnd = CarbonImmutable::create($bidYear, 7, 31)->endOfDay();
        if ($d->lte($springEnd)) {
            return 'spring';
        }

        return 'fall';
    }

    /**
     * @param  list<CarbonImmutable>  $reliefDates
     */
    private function buildScheduleCallouts(array $rotation, array $reliefDates): string
    {
        $parts = [];
        if ($rotation['non_canonical_runs'] !== []) {
            $parts[] = 'Non–3/5 off streaks: '.implode(', ', $rotation['non_canonical_runs']).' day(s).';
        }

        if ($reliefDates !== []) {
            $reliefDates = array_values(array_unique(array_map(
                fn (CarbonImmutable $x) => $x->format('Y-m-d'),
                $reliefDates
            )));
            sort($reliefDates);
            $fmt = array_map(function (string $ymd) {
                return CarbonImmutable::parse($ymd)->format('n/j/y');
            }, $reliefDates);
            $sample = array_slice($fmt, 0, 12);
            $more = count($fmt) > 12 ? '…' : '';
            $parts[] = 'Work outside rotation (relief): '.implode(', ', $sample).$more;
        }

        return $parts === [] ? '—' : implode(' ', $parts);
    }
}
