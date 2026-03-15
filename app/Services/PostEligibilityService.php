<?php

namespace App\Services;

use App\Models\Shift;
use App\Models\SwapPost;
use App\Models\User;
use App\Models\WorkgroupDeskType;
use Carbon\Carbon;

class PostEligibilityService
{
    /**
     * Legacy map for shifts whose workgroup has no WorkgroupDeskType defined for that code.
     */
    private const DESK_TYPE_TO_QUALIFICATION_CODE = [
        'intl' => 'INTL',
        'etops' => 'ETOPS',
        'assistant_desk' => 'ASST',
        'domestic_dispatch' => 'DSP',
    ];

    public function __construct(
        protected ComplianceValidator $complianceValidator
    ) {}

    /**
     * Return true if the user is qualified to work the shift. Uses workgroup_desk_types when
     * present (required qualification from DB); otherwise falls back to legacy code mapping.
     */
    public function userCanWorkShift(User $user, Shift $shift): bool
    {
        $deskTypeCode = $shift->desk_type;
        if ($deskTypeCode === null || $deskTypeCode === '') {
            return true;
        }

        $workgroup = $shift->workgroup;
        if (! $workgroup) {
            return true;
        }

        $deskType = WorkgroupDeskType::where('workgroup_id', $workgroup->id)
            ->where('code', $deskTypeCode)
            ->first();

        if ($deskType) {
            if ($deskType->workgroup_qualification_id === null) {
                return true;
            }

            return $user->workgroupQualifications()
                ->where('workgroup_qualification_id', $deskType->workgroup_qualification_id)
                ->exists();
        }

        $qualCode = self::DESK_TYPE_TO_QUALIFICATION_CODE[strtolower($deskTypeCode)] ?? null;
        if ($qualCode === null) {
            return true;
        }

        $qual = $workgroup->qualifications()->where('code', $qualCode)->first();
        if (! $qual) {
            return true;
        }

        return $user->workgroupQualifications()
            ->where('workgroup_qualification_id', $qual->id)
            ->exists();
    }

    /**
     * Standard desk types for SOD-style workgroups when no desk types are defined in DB yet.
     */
    private const SOD_DESK_TYPES = ['regional', 'sector', 'nextday', 'extra'];

    /**
     * Return list of desk_type codes the user is qualified to work. Uses workgroup_desk_types
     * (and optional required qualification) plus shifts; SOD fallback when workgroup name contains "sod".
     *
     * @return array<int, string>
     */
    public function getQualifiedDeskTypesForUser(User $user): array
    {
        $workgroups = $user->workgroups()->with(['qualifications', 'deskTypes', 'positionRanges.deskType'])->get();
        $qualified = [];
        foreach ($workgroups as $workgroup) {
            $deskTypeCodes = $workgroup->deskTypes->pluck('code')->filter()->unique()->values();
            $deskTypesFromRanges = $workgroup->positionRanges->map(fn ($r) => $r->deskType?->code)->filter()->unique()->values();
            $deskTypesFromShifts = Shift::where('workgroup_id', $workgroup->id)
                ->whereNotNull('desk_type')
                ->where('desk_type', '!=', '')
                ->distinct()
                ->pluck('desk_type');
            $deskTypeCodes = $deskTypeCodes->merge($deskTypesFromRanges)->merge($deskTypesFromShifts)->unique();
            if (str_contains(strtolower($workgroup->name ?? ''), 'sod')) {
                $deskTypeCodes = $deskTypeCodes->merge(self::SOD_DESK_TYPES)->unique();
            }
            $deskTypeCodes = $deskTypeCodes->values();
            foreach ($deskTypeCodes as $code) {
                $shift = new Shift;
                $shift->desk_type = $code;
                $shift->workgroup_id = $workgroup->id;
                $shift->setRelation('workgroup', $workgroup);
                if ($this->userCanWorkShift($user, $shift)) {
                    $qualified[$code] = true;
                }
            }
        }
        return array_keys($qualified);
    }

    /**
     * Return qualified desk types grouped by workgroup. Uses workgroup_desk_types; each desk type
     * may require a qualification (admin-defined).
     *
     * @return array<int, array{workgroup_id: int, workgroup_name: string, desk_types: array<int, string>}>
     */
    public function getQualifiedDeskTypesByWorkgroup(User $user): array
    {
        $workgroups = $user->workgroups()->with(['qualifications', 'deskTypes', 'positionRanges.deskType'])->get();
        $result = [];
        foreach ($workgroups as $workgroup) {
            $deskTypeCodes = $workgroup->deskTypes->pluck('code')->filter()->unique()->values();
            $deskTypesFromRanges = $workgroup->positionRanges->map(fn ($r) => $r->deskType?->code)->filter()->unique()->values();
            $deskTypesFromShifts = Shift::where('workgroup_id', $workgroup->id)
                ->whereNotNull('desk_type')
                ->where('desk_type', '!=', '')
                ->distinct()
                ->pluck('desk_type');
            $deskTypeCodes = $deskTypeCodes->merge($deskTypesFromRanges)->merge($deskTypesFromShifts)->unique();
            if (str_contains(strtolower($workgroup->name ?? ''), 'sod')) {
                $deskTypeCodes = $deskTypeCodes->merge(self::SOD_DESK_TYPES)->unique();
            }
            $deskTypeCodes = $deskTypeCodes->values();
            $qualifiedForWg = [];
            foreach ($deskTypeCodes as $code) {
                $shift = new Shift;
                $shift->desk_type = $code;
                $shift->workgroup_id = $workgroup->id;
                $shift->setRelation('workgroup', $workgroup);
                if ($this->userCanWorkShift($user, $shift)) {
                    $qualifiedForWg[] = $code;
                }
            }
            if (count($qualifiedForWg) > 0) {
                $result[] = [
                    'workgroup_id' => $workgroup->id,
                    'workgroup_name' => $workgroup->name ?? 'Workgroup',
                    'desk_types' => array_values($qualifiedForWg),
                ];
            }
        }
        return $result;
    }

    /**
     * Check if the user can take a giveaway (cash) post: adding the post's shift would pass compliance.
     *
     * @return array{eligible: bool, reason?: string}
     */
    public function canTakeGiveaway(User $user, SwapPost $post): array
    {
        $shift = $post->shift;
        if (! $shift) {
            return ['eligible' => false, 'reason' => 'Missing shift.'];
        }

        $workgroup = $shift->workgroup;
        if (! $workgroup) {
            return ['eligible' => false, 'reason' => 'Missing workgroup.'];
        }

        $userShifts = Shift::where('user_id', $user->id)->get()->map(fn (Shift $s) => [
            'id' => $s->id,
            'start_time_utc' => $s->start_time_utc,
            'end_time_utc' => $s->end_time_utc,
            'regulatory' => $s->regulatory,
        ])->toArray();

        $postedShift = [
            'id' => $shift->id,
            'start_time_utc' => $shift->start_time_utc,
            'end_time_utc' => $shift->end_time_utc,
            'regulatory' => $shift->regulatory,
        ];
        $userShifts[] = $postedShift;

        $result = $this->complianceValidator->validateForUser(
            $user->id,
            $userShifts,
            [],
            $workgroup->id,
            $workgroup->regulatory,
            $workgroup->max_hours_per_day ?? 10,
            $workgroup->rest_required_hours ?? ComplianceValidator::REST_HOURS,
            $workgroup->allow_double ?? false
        );

        if ($result['valid']) {
            return ['eligible' => true];
        }

        $fullError = $result['errors'][0] ?? 'Compliance check failed.';
        $reason = $fullError;
        if (str_contains($fullError, 'rest')) {
            $reason = 'Rest';
        } elseif (str_contains($fullError, 'hours') || str_contains($fullError, 'daily')) {
            $reason = 'Duty day';
        } elseif (str_contains($fullError, 'overlap')) {
            $reason = 'Overlap';
        }

        return ['eligible' => false, 'reason' => $reason, 'reason_detail' => $fullError];
    }

    /**
     * Check if the user can take a flight_follow post: has DSP qualification and adding
     * a segment of flight_follow_minutes would pass compliance.
     *
     * @return array{eligible: bool, reason?: string}
     */
    public function canTakeFlightFollow(User $user, SwapPost $post): array
    {
        $shift = $post->shift;
        if (! $shift) {
            return ['eligible' => false, 'reason' => 'Missing shift.'];
        }

        $workgroup = $shift->workgroup;
        if (! $workgroup) {
            return ['eligible' => false, 'reason' => 'Missing workgroup.'];
        }

        $hasDsp = $user->workgroupQualifications()
            ->where('workgroup_id', $workgroup->id)
            ->where('code', 'DSP')
            ->exists();
        if (! $hasDsp) {
            return ['eligible' => false, 'reason' => 'DSP qualification required.'];
        }

        $minutes = (int) ($post->flight_follow_minutes ?? 0);
        if ($minutes <= 0) {
            return ['eligible' => false, 'reason' => 'Invalid flight follow minutes.'];
        }

        $segmentStart = $shift->start_time_utc instanceof Carbon
            ? $shift->start_time_utc->copy()
            : Carbon::parse($shift->start_time_utc);
        $segmentEnd = $segmentStart->copy()->addMinutes($minutes);

        $userShifts = Shift::where('user_id', $user->id)->get()->map(fn (Shift $s) => [
            'id' => $s->id,
            'start_time_utc' => $s->start_time_utc,
            'end_time_utc' => $s->end_time_utc,
            'regulatory' => $s->regulatory,
        ])->toArray();

        $segment = [
            'start_time_utc' => $segmentStart,
            'end_time_utc' => $segmentEnd,
        ];

        $result = $this->complianceValidator->validateForUser(
            $user->id,
            $userShifts,
            [$segment],
            $workgroup->id,
            true,
            $workgroup->max_hours_per_day ?? 10,
            $workgroup->rest_required_hours ?? ComplianceValidator::REST_HOURS,
            $workgroup->allow_double ?? false
        );

        if ($result['valid']) {
            return ['eligible' => true];
        }

        $fullError = $result['errors'][0] ?? 'Compliance check failed.';
        $reason = $fullError;
        if (str_contains($fullError, 'rest')) {
            $reason = 'Rest';
        } elseif (str_contains($fullError, 'hours') || str_contains($fullError, 'daily')) {
            $reason = 'Duty day';
        } elseif (str_contains($fullError, 'overlap')) {
            $reason = 'Overlap';
        }

        return ['eligible' => false, 'reason' => $reason, 'reason_detail' => $fullError];
    }
}
