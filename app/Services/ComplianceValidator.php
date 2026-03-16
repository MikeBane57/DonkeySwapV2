<?php

namespace App\Services;

use App\Models\ComplianceAuditLog;
use App\Models\Shift;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ComplianceValidator
{
    public const REST_HOURS = 8;

    public const MAX_OVERLAP_NON_REGULATORY_MINUTES = 30;

    /**
     * Validate that assigning a set of shifts (and optional segments) to a user would comply with rules.
     * All times are in UTC.
     *
     * @param  array<int, array{start_time_utc: string|\Carbon\Carbon, end_time_utc: string|\Carbon\Carbon, regulatory?: bool}>  $shifts  Main shifts (with start_time_utc, end_time_utc, regulatory)
     * @param  array<int, array{start_time_utc: string|\Carbon\Carbon, end_time_utc: string|\Carbon\Carbon}>  $segments  Optional flight-follow segments to include in totals
     * @return array{valid: bool, errors: array<int, string>, audit?: array}
     */
    public function validateForUser(
        int $userId,
        array $shifts,
        array $segments = [],
        ?int $workgroupId = null,
        ?bool $regulatory = null,
        ?int $maxHoursPerDay = null,
        ?int $restRequiredHours = null,
        ?bool $allowDouble = null
    ): array {
        $user = User::find($userId);
        $errors = [];
        $allBlocks = $this->collectBlocks($shifts, $segments);
        $restHours = $restRequiredHours ?? self::REST_HOURS;

        if ($workgroupId && $user) {
            $wg = $user->workgroups()->where('workgroup_id', $workgroupId)->first();
            if ($wg) {
                $pivot = $wg->pivot;
                $allowDouble = $allowDouble ?? $wg->allow_double;
            }
        }

        $regulatoryStrict = $regulatory ?? true;
        $maxHours = $maxHoursPerDay ?? 10;

        // 1. No overlap (and max 30 min for non-regulatory)
        foreach ($allBlocks as $i => $blockA) {
            foreach ($allBlocks as $j => $blockB) {
                if ($i >= $j) {
                    continue;
                }
                $overlap = $this->overlapMinutes($blockA['start'], $blockA['end'], $blockB['start'], $blockB['end']);
                if ($overlap > 0) {
                    if ($blockA['regulatory'] || $blockB['regulatory']) {
                        $errors[] = 'Shifts overlap; regulatory rules require no overlap.';
                        break 2;
                    }
                    if ($overlap > self::MAX_OVERLAP_NON_REGULATORY_MINUTES) {
                        $errors[] = 'Shifts overlap by more than 30 minutes (non-regulatory max).';
                        break 2;
                    }
                }
            }
        }

        // 2. Per-day hours (regulatory: ≤ max_hours_per_day; non-regulatory: allow >10 if allow_double)
        $byDay = $this->groupBlocksByDay($allBlocks);
        foreach ($byDay as $day => $blocks) {
            $dayMinutes = collect($blocks)->sum(fn ($b) => $b['end']->diffInMinutes($b['start']));
            $dayHours = $dayMinutes / 60;
            if ($regulatoryStrict && $dayHours > $maxHours) {
                $errors[] = "Regulatory: daily hours ({$dayHours}) exceed max ({$maxHours}).";
            }
            if (! $regulatoryStrict && ! ($allowDouble ?? false) && $dayHours > $maxHours) {
                $errors[] = "Daily hours ({$dayHours}) exceed max ({$maxHours}) and doubles not allowed.";
            }
        }

        // 3 & 4. Rest rules: only apply when workgroup is regulatory OR any shift is regulatory.
        // SOD (non-regulatory): no rest required between non-regulatory shifts; only duty day and overlap apply.
        $hasRegulatoryBlock = $allBlocks->contains(fn ($b) => $b['regulatory'] ?? false);
        $requireRest = $regulatoryStrict || $hasRegulatoryBlock;

        if ($requireRest) {
            $sorted = $allBlocks->sortBy(fn ($b) => $b['start']->getTimestamp())->values();
            $restMinsRequired = $restHours * 60;

            // 3. Rest before: 8 hours from previous shift end
            for ($i = 1; $i < $sorted->count(); $i++) {
                $prevEnd = $sorted[$i - 1]['end'];
                $currStart = $sorted[$i]['start'];
                $restMins = (int) (($currStart->getTimestamp() - $prevEnd->getTimestamp()) / 60);
                if ($restMins < $restMinsRequired) {
                    $errors[] = "Less than {$restHours} hours rest before shift starting at {$currStart->toIso8601String()}.";
                }
            }

            // 4. Rest after: 8 hours after shift end (no shift in rest window)
            for ($i = 0; $i < $sorted->count(); $i++) {
                $end = $sorted[$i]['end'];
                $restUntil = $end->copy()->addHours($restHours);
                foreach ($sorted as $j => $other) {
                    if ($j === $i) {
                        continue;
                    }
                    if ($other['start']->lt($restUntil) && $other['end']->gt($end)) {
                        $errors[] = 'A shift falls within the required rest window after another shift.';
                        break 2;
                    }
                }
            }
        }

        // 5. Midnight crossing: rest window that crosses midnight is still one continuous block (handled by using UTC and comparing start/end)

        if (count($errors) > 0) {
            $audit = [
                'user_id' => $userId,
                'action_type' => 'compliance_validation_failed',
                'shift_ids' => array_column($shifts, 'id'),
                'rule_violated' => implode('; ', $errors),
                'message' => $errors[0] ?? 'Validation failed',
                'metadata' => ['errors' => $errors],
            ];
            ComplianceAuditLog::create($audit);

            return [
                'valid' => false,
                'errors' => $errors,
                'audit' => $audit,
            ];
        }

        return ['valid' => true, 'errors' => []];
    }

    /**
     * @param  array<int, array{start_time_utc: string|\Carbon\Carbon, end_time_utc: string|\Carbon\Carbon, regulatory?: bool}>  $shifts
     * @param  array<int, array{start_time_utc: string|\Carbon\Carbon, end_time_utc: string|\Carbon\Carbon}>  $segments
     */
    private function collectBlocks(array $shifts, array $segments): Collection
    {
        $blocks = [];
        foreach ($shifts as $s) {
            $start = $s['start_time_utc'] instanceof Carbon
                ? $s['start_time_utc']
                : Carbon::parse($s['start_time_utc']);
            $end = $s['end_time_utc'] instanceof Carbon
                ? $s['end_time_utc']
                : Carbon::parse($s['end_time_utc']);
            $blocks[] = [
                'start' => $start,
                'end' => $end,
                'regulatory' => $s['regulatory'] ?? false,
            ];
        }
        foreach ($segments as $seg) {
            $start = $seg['start_time_utc'] instanceof Carbon
                ? $seg['start_time_utc']
                : Carbon::parse($seg['start_time_utc']);
            $end = $seg['end_time_utc'] instanceof Carbon
                ? $seg['end_time_utc']
                : Carbon::parse($seg['end_time_utc']);
            $blocks[] = [
                'start' => $start,
                'end' => $end,
                'regulatory' => true,
            ];
        }

        return collect($blocks);
    }

    private function overlapMinutes(Carbon $s1, Carbon $e1, Carbon $s2, Carbon $e2): int
    {
        $start = $s1->greaterThan($s2) ? $s1 : $s2;
        $end = $e1->lessThan($e2) ? $e1 : $e2;
        if ($start->gte($end)) {
            return 0;
        }

        return $start->diffInMinutes($end);
    }

    private function groupBlocksByDay(Collection $blocks): array
    {
        $byDay = [];
        foreach ($blocks as $b) {
            $day = $b['start']->format('Y-m-d');
            if (! isset($byDay[$day])) {
                $byDay[$day] = [];
            }
            $byDay[$day][] = $b;
        }

        return $byDay;
    }

    /**
     * Validate existing shifts for a user (e.g. before a trade). Fetches shifts from DB and includes segments.
     */
    public function validateUserShifts(User $user, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = $from ?? now()->startOfDay();
        $to = $to ?? now()->addYear();

        $shifts = Shift::where('user_id', $user->id)
            ->where('end_time_utc', '>=', $from)
            ->where('start_time_utc', '<=', $to)
            ->get();

        $shiftArray = $shifts->map(fn (Shift $s) => [
            'id' => $s->id,
            'start_time_utc' => $s->start_time_utc,
            'end_time_utc' => $s->end_time_utc,
            'regulatory' => $s->regulatory,
        ])->toArray();

        $segmentArray = [];
        foreach ($shifts as $shift) {
            foreach ($shift->segments as $seg) {
                $segmentArray[] = [
                    'start_time_utc' => $seg->start_time_utc,
                    'end_time_utc' => $seg->end_time_utc,
                ];
            }
        }

        $workgroup = $shifts->first()?->workgroup;
        $maxHours = $workgroup?->max_hours_per_day ?? 10;
        $restHours = $workgroup?->rest_required_hours ?? 8;
        $allowDouble = $workgroup?->allow_double ?? false;

        return $this->validateForUser(
            $user->id,
            $shiftArray,
            $segmentArray,
            $workgroup?->id,
            $workgroup?->regulatory,
            $maxHours,
            $restHours,
            $allowDouble
        );
    }
}
