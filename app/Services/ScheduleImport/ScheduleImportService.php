<?php

namespace App\Services\ScheduleImport;

use App\Models\AdminNotificationBatch;
use App\Models\AppNotification;
use App\Models\BulkApplyBatch;
use App\Models\ScheduleImportRun;
use App\Models\ScheduleReconciliation;
use App\Models\ScheduleReconciliationItem;
use App\Models\ScheduleImportRunItem;
use App\Models\ScheduleUnmappedCode;
use App\Models\Shift;
use App\Models\User;
use App\Models\WorkgroupDeskType;
use App\Models\Setting;
use App\Models\WorkgroupPositionRange;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;

class ScheduleImportService
{
    public const string SOURCE = 'aris_expanded_schedule';

    /** All CSV schedule times are in Central (America/Chicago). We convert to UTC for storage. */
    public const string TIMEZONE = 'America/Chicago';

    /** Default 8.5 hours in minutes */
    public const int DURATION_MINUTES = 510;

    /** Max file size (50 MB) for CSV uploads */
    public const int MAX_CSV_BYTES = 50 * 1024 * 1024;

    /** Min distinct employee IDs in a CSV to store it as latest master (for auto bulk compare) */
    public const int MIN_EMPLOYEES_FOR_MASTER_CSV = 10;

    /** Storage path key for latest master CSV (under default local disk) */
    public const string LATEST_MASTER_CSV_PATH = 'latest_master_schedule.csv';

    /** Desk codes that represent leave/time off - do not import as shifts */
    private const array LEAVE_DESK_CODES = [
        'OFF', 'VAC', 'GDO', 'SICK', 'BEREAV', 'FMLA', 'JURY', 'HOL',
    ];

    /** Desk codes that indicate training (show on board but not tradable) */
    private const array TRAINING_DESK_CODES = ['TRN', 'ITR'];

    /**
     * Convert time_code (e.g. "0600", "14") and date to start/end UTC.
     * CSV gives date (YYYY-MM-DD) and start hour; we treat the time as Central (America/Chicago)
     * then convert to UTC for storage. Uses createFromFormat so the timezone is applied reliably
     * (parse() can ignore the timezone in some PHP/Carbon configs and cause wrong dates).
     *
     * @param  string  $timeCode  Hour or HHMM in Central (e.g. "6", "0600", "14:00")
     * @param  string  $dateYmd   Date from CSV (YYYY-MM-DD)
     * @return array{start_utc: \Carbon\Carbon, end_utc: \Carbon\Carbon}|null
     */
    public function timeCodeToStartEnd(string $timeCode, string $dateYmd): ?array
    {
        $hour = $this->parseTimeCodeHour($timeCode);
        if ($hour === null) {
            return null;
        }
        $tz = new \DateTimeZone(self::TIMEZONE);
        $localString = $dateYmd.' '.sprintf('%02d:00:00', $hour);
        $startLocal = Carbon::createFromFormat('Y-m-d H:i:s', $localString, $tz);
        if ($startLocal === false) {
            return null;
        }
        $startUtc = $startLocal->copy()->setTimezone('UTC');
        $endUtc = $startUtc->copy()->addMinutes(self::DURATION_MINUTES);

        return ['start_utc' => $startUtc, 'end_utc' => $endUtc];
    }

    private function parseTimeCodeHour(string $timeCode): ?int
    {
        $t = trim($timeCode);
        if (preg_match('/^\d{1,2}$/', $t)) {
            $h = (int) $t;
            if ($h >= 0 && $h <= 23) {
                return $h;
            }
        }
        if (preg_match('/^(\d{1,2}):(\d{2})/', $t, $m)) {
            return (int) $m[1];
        }
        // 4-digit HHMM (e.g. 0600, 1400, 1200)
        if (preg_match('/^\d{4}$/', $t)) {
            $h = (int) substr($t, 0, 2);
            if ($h >= 0 && $h <= 23) {
                return $h;
            }
        }
        // 3-digit HMM (e.g. 600 → 6:00)
        if (preg_match('/^\d{3}$/', $t)) {
            $h = (int) substr($t, 0, 1);
            if ($h >= 0 && $h <= 23) {
                return $h;
            }
        }

        return null;
    }

    /**
     * Resolve desk_code to workgroup_id, desk_type (code), position_name, regulatory.
     * Prefers workgroups the user belongs to. If unmapped, records in schedule_unmapped_codes
     * and returns generic resolution using user's first workgroup.
     *
     * @param  array<string, mixed>  $context  Optional context for examples (e.g. user_name, employee_id, shift_date, time_code)
     * @return array{workgroup_id: int, desk_type: string, position_name: string, regulatory: bool, unmapped: bool}
     */
    public function resolveDeskCode(string $deskCode, User $user, array $context = []): array
    {
        $deskCode = trim($deskCode);
        $userWorkgroupIds = $user->workgroups()->pluck('workgroups.id')->all();

        if (empty($userWorkgroupIds)) {
            $this->recordUnmapped('desk', $deskCode, array_merge($context, ['reason' => 'user_has_no_workgroup']));

            return [
                'workgroup_id' => 0,
                'desk_type' => $deskCode,
                'position_name' => $deskCode,
                'regulatory' => false,
                'unmapped' => true,
            ];
        }

        $ranges = WorkgroupPositionRange::with('workgroup', 'deskType')
            ->whereIn('workgroup_id', $userWorkgroupIds)
            ->get();

        foreach ($ranges as $range) {
            $labels = $range->expandToLabels();
            if (in_array($deskCode, $labels, true)) {
                $deskType = $range->deskType;
                $code = $deskType ? $deskType->code : 'extra';
                $regulatory = $deskType && $deskType->is_regulatory;

                return [
                    'workgroup_id' => $range->workgroup_id,
                    'desk_type' => $code,
                    'position_name' => $deskCode,
                    'regulatory' => $regulatory,
                    'unmapped' => false,
                ];
            }
        }

        // Not in any range: use first user workgroup, generic desk
        $this->recordUnmapped('desk', $deskCode, $context);

        return [
            'workgroup_id' => $userWorkgroupIds[0],
            'desk_type' => $deskCode,
            'position_name' => $deskCode,
            'regulatory' => false,
            'unmapped' => true,
        ];
    }

    /**
     * Resolve desk: use workgroup_id + desk_type override from row if present and valid; else resolveDeskCode.
     *
     * @param  array<string, mixed>  $row
     * @return array{workgroup_id: int, desk_type: string, position_name: string, regulatory: bool, unmapped: bool}
     */
    private function resolveDeskCodeWithOverride(array $row, string $deskCode, User $user): array
    {
        $wgId = isset($row['workgroup_id']) ? (int) $row['workgroup_id'] : 0;
        $overrideCode = $row['desk_type'] ?? null;
        if ($wgId > 0 && is_string($overrideCode) && $overrideCode !== '') {
            $dt = WorkgroupDeskType::where('workgroup_id', $wgId)->where('code', $overrideCode)->first();
            if ($dt) {
                return [
                    'workgroup_id' => $wgId,
                    'desk_type' => $dt->code,
                    'position_name' => $deskCode,
                    'regulatory' => $dt->is_regulatory,
                    'unmapped' => false,
                ];
            }
        }

        $context = [
            'user_name' => $user->name,
            'employee_id' => $user->employee_id ?? null,
            'shift_date' => $row['shift_date'] ?? null,
            'time_code' => $row['time_code'] ?? null,
        ];

        return $this->resolveDeskCode($deskCode, $user, $context);
    }

    public function recordUnmapped(string $codeType, string $code, array $example = []): void
    {
        $now = now();
        $row = ScheduleUnmappedCode::firstOrCreate(
            [
                'source' => self::SOURCE,
                'code_type' => $codeType,
                'code' => $code,
            ],
            [
                'seen_count' => 1,
                'first_seen_at' => $now,
                'last_seen_at' => $now,
            ]
        );
        if ($row->wasRecentlyCreated === false) {
            $row->increment('seen_count');
            $row->update(['last_seen_at' => $now]);
        }
        if (! empty($example)) {
            $examples = $row->examples ?? [];
            if (count($examples) < 10) {
                $examples[] = $example;
                $row->update(['examples' => array_slice($examples, -10)]);
            }
        }
    }

    /**
     * Filter out leave-only rows (desk_code is leave type).
     */
    public function filterLeaveRows(array $parsedRows): array
    {
        return array_values(array_filter($parsedRows, function (array $row) {
            $desk = strtoupper(trim((string) ($row['desk_code'] ?? '')));

            return $desk !== '' && ! in_array($desk, self::LEAVE_DESK_CODES, true);
        }));
    }

    /**
     * Build preview for a single user from parsed rows (already filtered to that user's employee_id).
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{preview: array<int, array<string, mixed>>, unmapped: array<int, string>, errors: array<int, string>}
     */
    public function previewForUser(array $rows, User $user): array
    {
        $preview = [];
        $unmapped = [];
        $errors = [];

        foreach ($rows as $row) {
            $dateStr = $row['shift_date'] ?? '';
            $timeCode = $row['time_code'] ?? '';
            $deskCode = $row['desk_code'] ?? '';
            $inPast = ! empty($row['_past']);
            $context = [
                'user_name' => $user->name,
                'employee_id' => $user->employee_id ?? null,
                'shift_date' => $dateStr,
                'time_code' => $timeCode,
            ];
            $resolved = $this->resolveDeskCode($deskCode, $user, $context);
            if ($resolved['workgroup_id'] === 0) {
                $errors[] = "No workgroup for user; cannot place desk {$deskCode}.";
                continue;
            }
            $times = $this->timeCodeToStartEnd($timeCode, $dateStr);
            if (! $times) {
                $errors[] = "Invalid time_code '{$timeCode}' on {$dateStr}.";
                $this->recordUnmapped('time', $timeCode, ['date' => $dateStr]);

                continue;
            }
            if ($resolved['unmapped']) {
                $unmapped[] = $deskCode;
            }
            $preview[] = [
                'shift_date' => $dateStr,
                'time_code' => $timeCode,
                'desk_code' => $deskCode,
                'start_utc' => $times['start_utc']->toIso8601String(),
                'end_utc' => $times['end_utc']->toIso8601String(),
                'workgroup_id' => $resolved['workgroup_id'],
                'desk_type' => $resolved['desk_type'],
                'position_name' => $resolved['position_name'],
                'regulatory' => $resolved['regulatory'],
                'unmapped_desk' => $resolved['unmapped'],
                'in_past' => $inPast,
                '_resolved' => $resolved,
                '_times' => $times,
            ];
        }

        return [
            'preview' => $preview,
            'unmapped' => array_values(array_unique($unmapped)),
            'errors' => $errors,
        ];
    }

    /**
     * Compare preview (future rows only) to user's current shifts. Returns to_add, to_remove, to_modify for reconcile UI.
     *
     * @param  array<int, array<string, mixed>>  $preview  Result from previewForUser (must include start_utc, end_utc, position_name, desk_type, workgroup_id, regulatory, in_past)
     * @return array{to_add: array, to_remove: array, to_modify: array}
     */
    public function comparePreviewToBoard(array $preview, User $user): array
    {
        $future = array_values(array_filter($preview, fn (array $r) => empty($r['in_past'])));
        if (count($future) === 0) {
            return ['to_add' => [], 'to_remove' => [], 'to_modify' => []];
        }

        $dateMin = min(array_column($future, 'shift_date'));
        $dateMax = max(array_column($future, 'shift_date'));
        $startUtc = Carbon::parse($dateMin.' 00:00:00', self::TIMEZONE)->utc();
        $endUtc = Carbon::parse($dateMax.' 23:59:59', self::TIMEZONE)->utc();

        $existing = Shift::where('user_id', $user->id)
            ->where('start_time_utc', '>=', $startUtc)
            ->where('start_time_utc', '<=', $endUtc)
            ->get();

        $previewByStart = [];
        foreach ($future as $row) {
            $key = $row['start_utc'] ?? '';
            if ($key !== '') {
                $previewByStart[$key] = $row;
            }
        }

        $toAdd = [];
        $toModify = [];
        $matchedShiftIds = [];

        foreach ($future as $row) {
            $startKey = $row['start_utc'] ?? '';
            if ($startKey === '') {
                continue;
            }
            $existingShift = $existing->first(fn (Shift $s) => $s->start_time_utc->toIso8601String() === $startKey);
            if (! $existingShift) {
                $toAdd[] = $row;
                continue;
            }
            $matchedShiftIds[] = $existingShift->id;
            $changes = [];
            if (($row['position_name'] ?? '') !== ($existingShift->position_name ?? '')) {
                $changes['position_name'] = ['old' => $existingShift->position_name, 'new' => $row['position_name'] ?? ''];
            }
            if (($row['desk_type'] ?? '') !== ($existingShift->desk_type ?? '')) {
                $changes['desk_type'] = ['old' => $existingShift->desk_type, 'new' => $row['desk_type'] ?? ''];
            }
            if ((int) ($row['workgroup_id'] ?? 0) !== (int) $existingShift->workgroup_id) {
                $changes['workgroup_id'] = ['old' => $existingShift->workgroup_id, 'new' => $row['workgroup_id'] ?? null];
            }
            if ((bool) ($row['regulatory'] ?? false) !== (bool) $existingShift->regulatory) {
                $changes['regulatory'] = ['old' => $existingShift->regulatory, 'new' => $row['regulatory'] ?? false];
            }
            $rowEnd = $row['end_utc'] ?? '';
            $existingEnd = $existingShift->end_time_utc?->toIso8601String();
            if ($rowEnd !== '' && $existingEnd !== null && $rowEnd !== $existingEnd) {
                $changes['end_utc'] = ['old' => $existingEnd, 'new' => $rowEnd];
            }
            if (count($changes) > 0) {
                $toModify[] = [
                    'preview_row' => $row,
                    'shift_id' => $existingShift->id,
                    'position_name' => $existingShift->position_name,
                    'start_time_utc' => $existingShift->start_time_utc->toIso8601String(),
                    'changes' => $changes,
                ];
            }
        }

        $previewStartSet = array_keys($previewByStart);
        $toRemove = [];
        foreach ($existing as $s) {
            $key = $s->start_time_utc->toIso8601String();
            if (! in_array($key, $previewStartSet, true)) {
                $toRemove[] = [
                    'id' => $s->id,
                    'position_name' => $s->position_name ?? '',
                    'start_time_utc' => $s->start_time_utc->toIso8601String(),
                    'end_time_utc' => $s->end_time_utc?->toIso8601String(),
                    'has_active_post' => $s->swapPosts()->where('status', 'open')->exists(),
                ];
            }
        }

        return [
            'to_add' => $toAdd,
            'to_remove' => $toRemove,
            'to_modify' => $toModify,
        ];
    }

    /**
     * Apply import for one user: upsert shifts, record run and items.
     * Does not delete shifts; missing shifts (in DB but not in import) are listed in result.
     *
     * One shift is created or updated per row. For two shifts on the same day (e.g. "double"),
     * the parser must emit two rows (same shift_date, different time_code/desk_code); each row
     * becomes one shift.
     *
     * @param  array<int, array<string, mixed>>  $rows  Parsed rows for this user only
     * @param  \App\Models\User|null  $actor  User running the import (for admin); defaults to $user
     * @param  int|null  $bulkApplyBatchId  Optional batch ID when applying from Bulk CSV
     * @return array{run: \App\Models\ScheduleImportRun, created: int, updated: int, skipped: int, conflict: int, missing_shift_ids: array<int, int>}
     */
    public function applyForUser(array $rows, User $user, string $mode = 'user', ?User $actor = null, ?int $bulkApplyBatchId = null): array
    {
        $actor = $actor ?? $user;
        $run = ScheduleImportRun::create([
            'created_by_user_id' => $actor->id,
            'target_user_id' => $user->id,
            'bulk_apply_batch_id' => $bulkApplyBatchId,
            'mode' => $mode,
            'source' => self::SOURCE,
            'timezone' => self::TIMEZONE,
            'status' => 'applied',
            'row_count' => count($rows),
            'created_count' => 0,
            'updated_count' => 0,
            'skipped_count' => 0,
            'conflict_count' => 0,
            'missing_count' => 0,
        ]);

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $conflict = 0;
        $missingShiftIds = [];
        $dateRange = [null, null];

        $tz = new \DateTimeZone(self::TIMEZONE);
        $monthStart = (new \DateTimeImmutable('now', $tz))->format('Y-m-01');

        foreach ($rows as $row) {
            $dateStr = $row['shift_date'] ?? '';
            $timeCode = $row['time_code'] ?? '';
            $deskCode = $row['desk_code'] ?? '';
            if (! empty($row['_past']) || $dateStr < $monthStart) {
                continue;
            }
            $resolved = $this->resolveDeskCodeWithOverride($row, $deskCode, $user);
            $times = $this->timeCodeToStartEnd($timeCode, $dateStr);

            $item = [
                'schedule_import_run_id' => $run->id,
                'user_id' => $user->id,
                'employee_id' => $user->employee_id,
                'employee_name' => $user->name,
                'qualifications' => $row['qualifications'] ?? null,
                'shift_date' => $dateStr,
                'time_code' => $timeCode,
                'desk_code' => $deskCode,
                'start_time_utc' => null,
                'end_time_utc' => null,
                'duration_minutes' => self::DURATION_MINUTES,
                'matched_shift_id' => null,
                'action' => 'skip',
                'reason' => null,
                'warnings' => $resolved['unmapped'] ? ['desk_unmapped' => $deskCode] : null,
            ];

            if ($resolved['workgroup_id'] === 0 || ! $times) {
                $item['reason'] = $resolved['workgroup_id'] === 0 ? 'user_has_no_workgroup' : 'invalid_time_code';
                ScheduleImportRunItem::create($item);
                $skipped++;

                continue;
            }

            $item['start_time_utc'] = $times['start_utc'];
            $item['end_time_utc'] = $times['end_utc'];
            if ($dateRange[0] === null || $dateStr < $dateRange[0]) {
                $dateRange[0] = $dateStr;
            }
            if ($dateRange[1] === null || $dateStr > $dateRange[1]) {
                $dateRange[1] = $dateStr;
            }

            $existing = Shift::where('user_id', $user->id)
                ->where('start_time_utc', $times['start_utc'])
                ->first();

            if ($existing) {
                $hasActivePost = $existing->swapPosts()->where('status', 'open')->exists();
                if ($hasActivePost) {
                    $item['action'] = 'conflict';
                    $item['reason'] = 'shift_has_active_post';
                    $item['matched_shift_id'] = $existing->id;
                    ScheduleImportRunItem::create($item);
                    $conflict++;
                    continue;
                }
                $before = [
                    'start_time_utc' => $existing->start_time_utc?->toIso8601String(),
                    'position_name' => $existing->position_name,
                    'desk_type' => $existing->desk_type,
                ];
                $existing->update([
                    'workgroup_id' => $resolved['workgroup_id'],
                    'position_name' => $resolved['position_name'],
                    'desk_type' => $resolved['desk_type'],
                    'regulatory' => $resolved['regulatory'],
                    'end_time_utc' => $times['end_utc'],
                    'is_training' => $this->isTrainingDesk($deskCode),
                ]);
                $item['action'] = 'update';
                $item['matched_shift_id'] = $existing->id;
                $item['meta'] = [
                    'before' => $before,
                    'after' => [
                        'start_time_utc' => $times['start_utc']->toIso8601String(),
                        'position_name' => $resolved['position_name'],
                        'desk_type' => $resolved['desk_type'],
                    ],
                ];
                ScheduleImportRunItem::create($item);
                $updated++;
            } else {
                $newShift = Shift::create([
                    'user_id' => $user->id,
                    'workgroup_id' => $resolved['workgroup_id'],
                    'position_name' => $resolved['position_name'],
                    'desk_type' => $resolved['desk_type'],
                    'start_time_utc' => $times['start_utc'],
                    'end_time_utc' => $times['end_utc'],
                    'regulatory' => $resolved['regulatory'],
                    'is_training' => $this->isTrainingDesk($deskCode),
                ]);
                $item['action'] = 'create';
                $item['matched_shift_id'] = $newShift->id;
                ScheduleImportRunItem::create($item);
                $created++;
            }
        }

        // Missing: shifts for this user in the import date range that were not in the import
        $missingShifts = [];
        if ($dateRange[0] && $dateRange[1]) {
            $startUtc = Carbon::parse($dateRange[0].' 00:00:00', self::TIMEZONE)->utc();
            $endUtc = Carbon::parse($dateRange[1].' 23:59:59', self::TIMEZONE)->utc();
            $importStartTimes = collect($rows)->map(function ($r) {
                $t = $this->timeCodeToStartEnd($r['time_code'] ?? '', $r['shift_date'] ?? '');

                return $t ? $t['start_utc']->toIso8601String() : null;
            })->filter()->all();
            $existingInRange = Shift::where('user_id', $user->id)
                ->where('start_time_utc', '>=', $startUtc)
                ->where('start_time_utc', '<=', $endUtc)
                ->get();
            foreach ($existingInRange as $s) {
                $key = $s->start_time_utc->toIso8601String();
                if (! in_array($key, $importStartTimes, true)) {
                    $missingShiftIds[] = $s->id;
                    $missingShifts[] = [
                        'id' => $s->id,
                        'position_name' => $s->position_name ?? '',
                        'start_time_utc' => $s->start_time_utc->toIso8601String(),
                        'end_time_utc' => $s->end_time_utc->toIso8601String(),
                        'has_active_post' => $s->swapPosts()->where('status', 'open')->exists(),
                    ];
                }
            }
        }

        $run->update([
            'created_count' => $created,
            'updated_count' => $updated,
            'skipped_count' => $skipped,
            'conflict_count' => $conflict,
            'missing_count' => count($missingShiftIds),
            'meta' => array_filter([
                'missing_shift_ids' => $missingShiftIds,
                'date_range' => $dateRange,
            ]),
        ]);

        return [
            'run' => $run->fresh(),
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'conflict' => $conflict,
            'missing_shift_ids' => $missingShiftIds,
            'missing_shifts' => $missingShifts,
        ];
    }

    private function isTrainingDesk(string $deskCode): bool
    {
        return in_array(strtoupper(trim($deskCode)), self::TRAINING_DESK_CODES, true);
    }

    /**
     * Compare master CSV rows to current user boards. Returns per-user diff: shifts to add (in master, not on board)
     * and shifts to remove (on board, not in master). Only includes users with at least one difference.
     *
     * @param  array<int, array<string, mixed>>  $rows  Parsed rows from master CSV (all employees)
     * @return array{users: array<int, array{user_id: int, name: string, employee_id: string, to_add: int, to_remove: int, to_add_detail: array, to_remove_detail: array, date_range: array}>, past_count: int}
     */
    public function compareMasterCsv(array $rows): array
    {
        $rows = $this->filterLeaveRows($rows);
        $tz = new \DateTimeZone(self::TIMEZONE);
        $monthStart = (new \DateTimeImmutable('now', $tz))->format('Y-m-01');
        $byEmployee = collect($rows)->groupBy('employee_id');
        $users = User::whereNotNull('employee_id')->whereIn('employee_id', $byEmployee->keys())->get()->keyBy('employee_id');
        $pastCount = collect($rows)->filter(fn ($r) => ! empty($r['_past']))->count();

        $unmatchedEmployees = [];
        foreach ($byEmployee as $empId => $empRows) {
            if ($users->has($empId)) {
                continue;
            }
            $first = $empRows->first();
            $unmatchedEmployees[] = [
                'employee_id' => $empId,
                'name' => $first['employee_name'] ?? '',
            ];
        }

        $result = [];
        foreach ($byEmployee as $empId => $userRows) {
            $user = $users->get($empId);
            if (! $user) {
                continue;
            }
            $userRows = array_values($userRows->filter(fn ($r) => empty($r['_past']) && ($r['shift_date'] ?? '') >= $monthStart)->all());
            $masterStartTimes = [];
            $masterDetail = [];
            foreach ($userRows as $r) {
                $times = $this->timeCodeToStartEnd($r['time_code'] ?? '', $r['shift_date'] ?? '');
                if ($times) {
                    $key = $times['start_utc']->toIso8601String();
                    $masterStartTimes[$key] = true;
                    $masterDetail[] = [
                        'shift_date' => $r['shift_date'],
                        'time_code' => $r['time_code'],
                        'desk_code' => $r['desk_code'],
                        'start_time_utc' => $key,
                    ];
                }
            }
            $dateRange = null;
            if (count($userRows) > 0) {
                $dates = array_column($masterDetail, 'shift_date');
                $dateRange = [min($dates), max($dates)];
            }
            if ($dateRange === null) {
                continue;
            }
            $startUtc = Carbon::parse($dateRange[0].' 00:00:00', self::TIMEZONE)->utc();
            $endUtc = Carbon::parse($dateRange[1].' 23:59:59', self::TIMEZONE)->utc();
            $currentShifts = Shift::where('user_id', $user->id)
                ->where('start_time_utc', '>=', $startUtc)
                ->where('start_time_utc', '<=', $endUtc)
                ->get();
            $toAdd = [];
            foreach ($masterDetail as $d) {
                $key = $d['start_time_utc'];
                if (! $currentShifts->contains(fn ($s) => $s->start_time_utc->toIso8601String() === $key)) {
                    $toAdd[] = $d;
                }
            }
            $toRemove = [];
            foreach ($currentShifts as $s) {
                $key = $s->start_time_utc->toIso8601String();
                if (! isset($masterStartTimes[$key])) {
                    $toRemove[] = [
                        'id' => $s->id,
                        'position_name' => $s->position_name ?? '',
                        'start_time_utc' => $key,
                        'has_active_post' => $s->swapPosts()->where('status', 'open')->exists(),
                    ];
                }
            }
            if (count($toAdd) > 0 || count($toRemove) > 0) {
                $result[] = [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'employee_id' => $user->employee_id,
                    'to_add' => count($toAdd),
                    'to_remove' => count($toRemove),
                    'to_add_detail' => $toAdd,
                    'to_remove_detail' => $toRemove,
                    'date_range' => $dateRange,
                ];
            }
        }

        return ['users' => $result, 'past_count' => $pastCount, 'unmatched_employees' => $unmatchedEmployees];
    }

    /**
     * If the CSV has more than MIN_EMPLOYEES_FOR_MASTER_CSV distinct employee IDs, store it as the
     * latest master CSV only when it is newer than the stored file (by last modified time).
     * Saves metadata, runs compare, and updates bulk_compare_latest. Used for both admin and user uploads.
     *
     * @param  array<int, array<string, mixed>>  $rows  Parsed rows (after filterLeaveRows)
     * @param  int|null  $fileLastModifiedMs  Client-reported file last modified time in milliseconds (e.g. from File.lastModified). If provided and we already have a stored file with a last modified time >= this, we skip storing so the newest file wins.
     */
    public function storeLatestMasterCsvIfEligible(string $content, array $rows, User $actor, string $source, ?int $fileLastModifiedMs = null): void
    {
        $byEmployee = collect($rows)->groupBy('employee_id');
        $employeeCount = $byEmployee->count();
        if ($employeeCount <= self::MIN_EMPLOYEES_FOR_MASTER_CSV) {
            return;
        }

        $disk = Storage::disk('local');
        if ($fileLastModifiedMs !== null && $disk->exists(self::LATEST_MASTER_CSV_PATH)) {
            $storedFileLastModifiedMs = null;
            $metaRaw = Setting::get('latest_master_csv_meta');
            if (is_string($metaRaw) && $metaRaw !== '') {
                $existing = json_decode($metaRaw, true);
                if (isset($existing['file_last_modified_ms']) && is_numeric($existing['file_last_modified_ms'])) {
                    $storedFileLastModifiedMs = (int) $existing['file_last_modified_ms'];
                }
            }
            if ($storedFileLastModifiedMs === null) {
                $storedFileLastModifiedMs = (int) ($disk->lastModified(self::LATEST_MASTER_CSV_PATH) * 1000);
            }
            if ($fileLastModifiedMs <= $storedFileLastModifiedMs) {
                return;
            }
        }

        $disk->put(self::LATEST_MASTER_CSV_PATH, $content);

        $meta = [
            'uploaded_at_iso' => now()->toIso8601String(),
            'uploaded_by_type' => $source,
            'uploaded_by_id' => $actor->id,
            'employee_count' => $employeeCount,
            'file_last_modified_ms' => $fileLastModifiedMs ?? (int) ($disk->lastModified(self::LATEST_MASTER_CSV_PATH) * 1000),
        ];
        Setting::set('latest_master_csv_meta', json_encode($meta));

        $compare = $this->compareMasterCsv($rows);
        $lastModifiedMs = $meta['file_last_modified_ms'];
        $lastRun = [
            'file_last_modified_ms' => $lastModifiedMs,
            'run_at_iso' => now()->toIso8601String(),
            'users' => $compare['users'],
            'unmatched_employees' => $compare['unmatched_employees'] ?? [],
        ];
        Setting::set('bulk_compare_latest', json_encode($lastRun));
    }

    /**
     * Read the stored latest master CSV content and return [content, parsed rows] or null if not present.
     *
     * @return array{0: string, 1: array<int, array<string, mixed>>}|null
     */
    public function getStoredLatestMasterCsvContent(): ?array
    {
        $disk = Storage::disk('local');
        if (! $disk->exists(self::LATEST_MASTER_CSV_PATH)) {
            return null;
        }
        $content = $disk->get(self::LATEST_MASTER_CSV_PATH);
        if (! is_string($content) || $content === '') {
            return null;
        }
        $parser = new ArisExpandedScheduleCsvParser;
        $parsed = $parser->parse($content);
        $rows = $this->filterLeaveRows($parsed['rows']);

        return [$content, $rows];
    }

    /**
     * Apply master CSV: for each user add missing shifts and remove shifts not in master;
     * create reconciliation so users must review (accept/reject added, keep/remove removed);
     * optionally notify users.
     *
     * @param  array<int, array<string, mixed>>  $rows  Parsed rows from master CSV
     * @return array{results: array<int, array{user_id: int, name: string, employee_id: string, created: int, updated: int, removed: int, notified: bool, reconciliation_id?: int, error?: string}>}
     */
    public function applyMasterCsv(array $rows, User $actor, bool $messageUsers = false): array
    {
        $rows = $this->filterLeaveRows($rows);
        $tz = new \DateTimeZone(self::TIMEZONE);
        $monthStart = (new \DateTimeImmutable('now', $tz))->format('Y-m-01');
        $byEmployee = collect($rows)->groupBy('employee_id');
        $users = User::whereNotNull('employee_id')->whereIn('employee_id', $byEmployee->keys())->get()->keyBy('employee_id');

        $bulkBatch = BulkApplyBatch::create(['created_by' => $actor->id]);

        $results = [];
        $notificationsByUser = [];

        foreach ($byEmployee as $empId => $userRows) {
            $user = $users->get($empId);
            if (! $user) {
                continue;
            }
            $userRows = array_values($userRows->filter(fn ($r) => empty($r['_past']) && ($r['shift_date'] ?? '') >= $monthStart)->all());
            if (count($userRows) === 0) {
                continue;
            }
            $runResult = null;
            try {
                $runResult = $this->applyForUser($userRows, $user, 'admin_bulk_push', $actor, $bulkBatch->id);
            } catch (\Throwable $e) {
                $results[] = [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'employee_id' => $user->employee_id,
                    'created' => 0,
                    'updated' => 0,
                    'removed' => 0,
                    'notified' => false,
                    'error' => $e->getMessage(),
                ];
                continue;
            }
            $run = $runResult['run'];
            $run->load('items');
            $meta = $run->meta ?? [];
            $missingShiftIds = $meta['missing_shift_ids'] ?? [];
            $created = $runResult['created'];
            $updated = $runResult['updated'];

            $hasReconcile = $created > 0 || $updated > 0 || count($missingShiftIds) > 0;
            $reconciliation = null;
            if ($hasReconcile) {
                $reconciliation = ScheduleReconciliation::create([
                    'user_id' => $user->id,
                    'bulk_apply_batch_id' => $bulkBatch->id,
                    'status' => 'pending',
                ]);
                foreach ($run->items as $item) {
                    if ($item->action === 'create' && $item->matched_shift_id) {
                        ScheduleReconciliationItem::create([
                            'schedule_reconciliation_id' => $reconciliation->id,
                            'type' => 'added',
                            'shift_id' => $item->matched_shift_id,
                            'snapshot' => null,
                        ]);
                    }
                    if ($item->action === 'update' && $item->matched_shift_id && ! empty($item->meta['before']) && ! empty($item->meta['after'])) {
                        ScheduleReconciliationItem::create([
                            'schedule_reconciliation_id' => $reconciliation->id,
                            'type' => 'updated',
                            'shift_id' => $item->matched_shift_id,
                            'snapshot' => $item->meta,
                        ]);
                    }
                }
                foreach ($missingShiftIds as $shiftId) {
                    $shift = Shift::find($shiftId);
                    if (! $shift || $shift->user_id !== $user->id) {
                        continue;
                    }
                    $snapshot = [
                        'user_id' => $shift->user_id,
                        'workgroup_id' => $shift->workgroup_id,
                        'position_name' => $shift->position_name,
                        'desk_type' => $shift->desk_type,
                        'start_time_utc' => $shift->start_time_utc?->toIso8601String(),
                        'end_time_utc' => $shift->end_time_utc?->toIso8601String(),
                        'regulatory' => $shift->regulatory,
                        'is_training' => $shift->is_training,
                    ];
                    ScheduleReconciliationItem::create([
                        'schedule_reconciliation_id' => $reconciliation->id,
                        'type' => 'removed',
                        'shift_id' => null,
                        'snapshot' => $snapshot,
                    ]);
                    $shift->swapPosts()->delete();
                    $shift->delete();
                }
            }

            $removed = count($missingShiftIds);
            $results[] = [
                'user_id' => $user->id,
                'name' => $user->name,
                'employee_id' => $user->employee_id,
                'created' => $created,
                'updated' => $updated,
                'removed' => $removed,
                'notified' => false,
                'reconciliation_id' => $reconciliation?->id,
            ];
            if ($messageUsers && $reconciliation) {
                $notificationsByUser[$user->id] = [
                    'reconciliation_id' => $reconciliation->id,
                    'created' => $created,
                    'updated' => $updated,
                    'removed' => $removed,
                ];
            }
        }

        if ($messageUsers && count($notificationsByUser) > 0) {
            $userIds = array_keys($notificationsByUser);
            AppNotification::whereIn('user_id', $userIds)
                ->whereNull('read_at')
                ->where('type', 'admin_message')
                ->get()
                ->each(function (AppNotification $n) {
                    if (! empty($n->data['reconciliation_id'] ?? null)) {
                        $n->update(['read_at' => now()]);
                    }
                });

            $batch = AdminNotificationBatch::create([
                'title' => 'Review schedule changes from admin bulk push',
                'body' => 'Your schedule was updated by an admin bulk push. Please review and confirm your shifts.',
                'created_by' => $actor->id,
                'active_at_start' => null,
                'active_at_end' => null,
            ]);
            $reconcileUrl = url('/app/reconcile-schedule');
            foreach ($notificationsByUser as $userId => $info) {
                $body = 'Your schedule was updated by an admin bulk push. Please review and confirm your shifts.';
                AppNotification::create([
                    'user_id' => $userId,
                    'type' => 'admin_message',
                    'data' => [
                        'title' => 'Review schedule changes from admin bulk push',
                        'message' => $body,
                        'reconciliation_id' => $info['reconciliation_id'],
                        'reconcile_url' => $reconcileUrl,
                    ],
                    'admin_notification_batch_id' => $batch->id,
                ]);
                foreach ($results as $i => $r) {
                    if (($r['user_id'] ?? null) === $userId) {
                        $results[$i]['notified'] = true;
                        break;
                    }
                }
            }
        }

        return ['results' => $results];
    }
}
