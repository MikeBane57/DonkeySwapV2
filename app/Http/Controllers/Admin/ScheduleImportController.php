<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BulkApplyBatch;
use App\Models\ScheduleImportRun;
use App\Models\ScheduleUnmappedCode;
use App\Models\Setting;
use App\Models\Shift;
use App\Models\User;
use App\Models\Workgroup;
use App\Models\WorkgroupDeskType;
use App\Models\WorkgroupPositionRange;
use App\Services\ScheduleImport\ArisExpandedScheduleCsvParser;
use App\Services\ScheduleImport\ScheduleImportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ScheduleImportController extends Controller
{
    public function index(Request $request): Response
    {
        $runs = ScheduleImportRun::with(['createdBy:id,name', 'targetUser:id,name,email,employee_id'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($run) => [
                'id' => $run->id,
                'created_at' => $run->created_at->toIso8601String(),
                'created_by_name' => $run->createdBy?->name,
                'target_user_name' => $run->targetUser?->name,
                'target_user_employee_id' => $run->targetUser?->employee_id,
                'mode' => $run->mode,
                'status' => $run->status,
                'row_count' => $run->row_count,
                'created_count' => $run->created_count,
                'updated_count' => $run->updated_count,
                'skipped_count' => $run->skipped_count,
                'conflict_count' => $run->conflict_count,
                'missing_count' => $run->missing_count,
            ]);

        $selectedRun = null;
        $audit = null;
        $runId = $request->input('run_id');
        if ($runId && $runId > 0) {
            $run = ScheduleImportRun::with(['targetUser:id,name,email,employee_id'])->find($runId);
            if ($run && $run->target_user_id) {
                $selectedRun = [
                    'id' => $run->id,
                    'created_at' => $run->created_at->toIso8601String(),
                    'target_user_name' => $run->targetUser?->name,
                    'target_user_employee_id' => $run->targetUser?->employee_id,
                    'mode' => $run->mode,
                ];
                $meta = $run->meta ?? [];
                $dateRange = $meta['date_range'] ?? null;
                if (is_array($dateRange) && count($dateRange) >= 2 && ! empty($dateRange[0]) && ! empty($dateRange[1])) {
                    $startUtc = Carbon::parse($dateRange[0].' 00:00:00', 'America/Chicago')->utc();
                    $endUtc = Carbon::parse($dateRange[1].' 23:59:59', 'America/Chicago')->utc();
                    $items = $run->items()->whereIn('action', ['create', 'update'])->get();
                    $importStartTimes = $items->map(fn ($i) => $i->start_time_utc?->toIso8601String())->filter()->unique()->all();
                    $currentShifts = Shift::where('user_id', $run->target_user_id)
                        ->where('start_time_utc', '>=', $startUtc)
                        ->where('start_time_utc', '<=', $endUtc)
                        ->get();
                    $currentStartTimes = $currentShifts->map(fn ($s) => $s->start_time_utc->toIso8601String())->all();
                    $missingFromBoard = $items->filter(fn ($i) => $i->start_time_utc && ! in_array($i->start_time_utc->toIso8601String(), $currentStartTimes, true))
                        ->map(fn ($i) => [
                            'shift_date' => $i->shift_date?->format('Y-m-d'),
                            'time_code' => $i->time_code,
                            'desk_code' => $i->desk_code,
                            'start_time_utc' => $i->start_time_utc?->toIso8601String(),
                            'action' => $i->action,
                        ])->values()->all();
                    $extraOnBoard = $currentShifts->filter(fn ($s) => ! in_array($s->start_time_utc->toIso8601String(), $importStartTimes, true))
                        ->map(fn ($s) => [
                            'id' => $s->id,
                            'position_name' => $s->position_name,
                            'start_time_utc' => $s->start_time_utc->toIso8601String(),
                            'end_time_utc' => $s->end_time_utc->toIso8601String(),
                        ])->values()->all();
                    $audit = [
                        'date_range' => $dateRange,
                        'import_count' => count($importStartTimes),
                        'current_count' => $currentShifts->count(),
                        'missing_from_board' => $missingFromBoard,
                        'extra_on_board' => $extraOnBoard,
                    ];
                } else {
                    $audit = ['date_range' => null, 'import_count' => 0, 'current_count' => 0, 'missing_from_board' => [], 'extra_on_board' => []];
                }
            }
        }

        $reconciliationBatches = BulkApplyBatch::with(['reconciliations' => fn ($q) => $q->with(['user:id,name,employee_id', 'items' => fn ($q2) => $q2->whereNotNull('user_action')])])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn ($b) => [
                'id' => $b->id,
                'created_at' => $b->created_at->toIso8601String(),
                'reconciliations' => $b->reconciliations->map(fn ($r) => [
                    'id' => $r->id,
                    'user_name' => $r->user?->name,
                    'user_employee_id' => $r->user?->employee_id,
                    'status' => $r->status,
                    'completed_at' => $r->completed_at?->toIso8601String(),
                    'items' => $r->items->map(fn ($i) => [
                        'type' => $i->type,
                        'user_action' => $i->user_action,
                        'reason' => $i->reason,
                        'snapshot' => $i->snapshot,
                    ])->values()->all(),
                ])->values()->all(),
            ])
            ->values()
            ->all();

        $lastBulkCompare = null;
        $raw = Setting::get('bulk_compare_latest');
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $lastBulkCompare = $decoded;
            }
        }

        // Do not run compareMasterCsv() here: it can exceed PHP/Bluehost limits and cause timeouts
        // (ERR_TIMED_OUT / connection reset). Bulk compare is populated when an admin uploads the
        // master CSV or via ScheduleImportService flows that call set('bulk_compare_latest', …).

        $latestMasterCsvMeta = null;
        $metaRaw = Setting::get('latest_master_csv_meta');
        if (is_string($metaRaw) && $metaRaw !== '') {
            $metaDecoded = json_decode($metaRaw, true);
            if (is_array($metaDecoded)) {
                $latestMasterCsvMeta = $metaDecoded;
            }
        }

        return Inertia::render('admin/import-history', [
            'runs' => $runs,
            'selectedRun' => $selectedRun,
            'audit' => $audit,
            'reconciliationBatches' => $reconciliationBatches,
            'lastBulkCompare' => $lastBulkCompare,
            'latestMasterCsvMeta' => $latestMasterCsvMeta,
        ]);
    }

    public function show(ScheduleImportRun $schedule_import_run): Response
    {
        $run = $schedule_import_run;
        $run->load(['createdBy:id,name', 'targetUser:id,name,email,employee_id']);
        $items = $run->items()->orderBy('shift_date')->orderBy('start_time_utc')->limit(500)->get()->map(fn ($i) => [
            'id' => $i->id,
            'shift_date' => $i->shift_date?->format('Y-m-d'),
            'time_code' => $i->time_code,
            'desk_code' => $i->desk_code,
            'start_time_utc' => $i->start_time_utc?->toIso8601String(),
            'end_time_utc' => $i->end_time_utc?->toIso8601String(),
            'action' => $i->action,
            'reason' => $i->reason,
            'matched_shift_id' => $i->matched_shift_id,
            'warnings' => $i->warnings,
        ]);

        return Inertia::render('admin/import-history-show', [
            'run' => [
                'id' => $run->id,
                'created_at' => $run->created_at->toIso8601String(),
                'created_by_name' => $run->createdBy?->name,
                'target_user_name' => $run->targetUser?->name,
                'target_user_employee_id' => $run->targetUser?->employee_id,
                'mode' => $run->mode,
                'status' => $run->status,
                'row_count' => $run->row_count,
                'created_count' => $run->created_count,
                'updated_count' => $run->updated_count,
                'skipped_count' => $run->skipped_count,
                'conflict_count' => $run->conflict_count,
                'missing_count' => $run->missing_count,
                'meta' => $run->meta,
            ],
            'items' => $items,
        ]);
    }

    public function bulkPage(): Response
    {
        return Inertia::render('admin/import-bulk');
    }

    /**
     * Redirect to combined Import History page (which includes compare/audit section).
     */
    public function audit(Request $request): RedirectResponse
    {
        $runId = $request->input('run_id');
        $url = $runId && $runId > 0
            ? route('admin.import-history', ['run_id' => $runId])
            : route('admin.import-history');

        return redirect($url);
    }

    public function unmapped(): Response
    {
        $codes = ScheduleUnmappedCode::orderBy('code_type')->orderBy('code')->get()->map(fn ($c) => [
            'id' => $c->id,
            'source' => $c->source,
            'code_type' => $c->code_type,
            'code' => $c->code,
            'seen_count' => $c->seen_count,
            'first_seen_at' => $c->first_seen_at?->toIso8601String(),
            'last_seen_at' => $c->last_seen_at?->toIso8601String(),
            'examples' => $c->examples,
        ]);

        $workgroups = Workgroup::with(['deskTypes:id,workgroup_id,code,label,is_regulatory'])
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($wg) => [
                'id' => $wg->id,
                'name' => $wg->name,
                'desk_types' => $wg->deskTypes->map(fn ($d) => ['id' => $d->id, 'code' => $d->code, 'label' => $d->label])->values()->all(),
            ])
            ->values()
            ->all();

        return Inertia::render('admin/import-unmapped-codes', [
            'codes' => $codes,
            'workgroups' => $workgroups,
        ]);
    }

    /**
     * Add an unmapped desk code to a workgroup: create desk type (or use existing) and position range, then remove from unmapped list.
     */
    public function unmappedAddToWorkgroup(Request $request): JsonResponse
    {
        $request->validate([
            'unmapped_code_id' => 'required|integer|exists:schedule_unmapped_codes,id',
            'workgroup_id' => 'required|integer|exists:workgroups,id',
            'desk_type_id' => 'nullable|integer|exists:workgroup_desk_types,id',
        ]);

        $unmapped = ScheduleUnmappedCode::findOrFail($request->input('unmapped_code_id'));
        if ($unmapped->code_type !== 'desk') {
            return response()->json(['message' => 'Only desk codes can be added to a workgroup.'], 422);
        }

        $workgroup = Workgroup::findOrFail($request->input('workgroup_id'));

        $deskTypeId = $request->input('desk_type_id');
        if ($deskTypeId) {
            $deskType = WorkgroupDeskType::where('id', $deskTypeId)->where('workgroup_id', $workgroup->id)->first();
            if (! $deskType) {
                return response()->json(['message' => 'Desk type not found in this workgroup.'], 422);
            }
        } else {
            $deskType = WorkgroupDeskType::create([
                'workgroup_id' => $workgroup->id,
                'code' => $unmapped->code,
                'label' => $unmapped->code,
                'is_regulatory' => false,
                'sort_order' => 999,
            ]);
        }

        $maxSort = WorkgroupPositionRange::where('workgroup_id', $workgroup->id)->max('sort_order') ?? 0;
        WorkgroupPositionRange::create([
            'workgroup_id' => $workgroup->id,
            'workgroup_desk_type_id' => $deskType->id,
            'range_spec' => $unmapped->code,
            'parity' => null,
            'sort_order' => $maxSort + 1,
        ]);

        $unmapped->delete();

        return response()->json(['message' => "Desk code \"{$unmapped->code}\" added to workgroup \"{$workgroup->name}\"."]);
    }

    public function destroyUnmapped(ScheduleUnmappedCode $schedule_unmapped_code): RedirectResponse
    {
        $schedule_unmapped_code->delete();

        return redirect()->back()->with('success', 'Removed this code from the unmapped list.');
    }

    public function bulkDestroyUnmapped(Request $request): RedirectResponse
    {
        $ids = $request->validate([
            'ids' => ['required', 'array', 'max:500'],
            'ids.*' => ['integer', 'exists:schedule_unmapped_codes,id'],
        ])['ids'];

        ScheduleUnmappedCode::whereIn('id', $ids)->delete();

        $n = count($ids);

        return redirect()->back()->with('success', "Removed {$n} code(s) from the unmapped list.");
    }

    public function clearAllUnmapped(): RedirectResponse
    {
        $n = ScheduleUnmappedCode::query()->delete();

        return redirect()->back()->with('success', "Cleared all {$n} unmapped code(s).");
    }

    public function bulkPreview(Request $request): JsonResponse
    {
        set_time_limit(120);
        $sizeError = $this->checkCsvSize($request);
        if ($sizeError !== null) {
            return response()->json(['message' => $sizeError], 413);
        }
        $content = $this->getCsvContent($request);
        if ($content === null) {
            return response()->json(['message' => 'No CSV file provided.'], 422);
        }

        $parser = new ArisExpandedScheduleCsvParser;
        $parsed = $parser->parse($content);
        $rows = $parsed['rows'];
        $service = new ScheduleImportService;
        $rows = $service->filterLeaveRows($rows);
        $fileLastModifiedMs = $this->parseFileLastModifiedMs($request);
        $service->storeLatestMasterCsvIfEligible($content, $rows, $request->user(), 'admin', $fileLastModifiedMs);

        $byEmployee = collect($rows)->groupBy('employee_id');
        $users = User::whereNotNull('employee_id')->whereIn('employee_id', $byEmployee->keys())->get()->keyBy('employee_id');
        $matched = [];
        $unmatched = [];
        foreach ($byEmployee as $empId => $userRows) {
            $u = $users->get($empId);
            if ($u) {
                $matched[] = [
                    'employee_id' => $empId,
                    'user_id' => $u->id,
                    'name' => $u->name,
                    'row_count' => count($userRows),
                ];
            } else {
                $unmatched[] = $empId;
            }
        }

        return response()->json([
            'matched' => $matched,
            'unmatched' => array_values($unmatched),
            'past_count' => $parsed['past_count'],
        ]);
    }

    public function bulkApply(Request $request): JsonResponse
    {
        set_time_limit(120);
        $sizeError = $this->checkCsvSize($request);
        if ($sizeError !== null) {
            return response()->json(['message' => $sizeError], 413);
        }
        $content = $this->getCsvContent($request);
        if ($content === null) {
            return response()->json(['message' => 'No CSV file provided.'], 422);
        }

        $parser = new ArisExpandedScheduleCsvParser;
        $parsed = $parser->parse($content);
        $rows = $parsed['rows'];
        $service = new ScheduleImportService;
        $rows = $service->filterLeaveRows($rows);
        $actor = $request->user();
        $fileLastModifiedMs = $this->parseFileLastModifiedMs($request);
        $service->storeLatestMasterCsvIfEligible($content, $rows, $actor, 'admin', $fileLastModifiedMs);
        $byEmployee = collect($rows)->groupBy('employee_id');
        $users = User::whereNotNull('employee_id')->whereIn('employee_id', $byEmployee->keys())->get()->keyBy('employee_id');
        $results = [];
        foreach ($byEmployee as $empId => $userRows) {
            $u = $users->get($empId);
            if (! $u) {
                $results[] = ['employee_id' => $empId, 'user_id' => null, 'run_id' => null, 'error' => 'No user with this Employee ID'];

                continue;
            }
            $arr = array_values($userRows->all());
            try {
                $result = DB::transaction(fn () => $service->applyForUser($arr, $u, 'admin', $actor));
            } catch (\Throwable $e) {
                $results[] = ['employee_id' => $empId, 'user_id' => $u->id, 'run_id' => null, 'error' => $e->getMessage()];

                continue;
            }
            $results[] = [
                'employee_id' => $empId,
                'user_id' => $u->id,
                'run_id' => $result['run']->id,
                'created' => $result['created'],
                'updated' => $result['updated'],
                'skipped' => $result['skipped'],
                'conflict' => $result['conflict'],
                'missing_shift_ids' => $result['missing_shift_ids'],
            ];
        }

        return response()->json(['results' => $results, 'past_count' => $parsed['past_count']]);
    }

    public function masterCompare(Request $request): JsonResponse
    {
        set_time_limit(120);
        $sizeError = $this->checkCsvSize($request);
        if ($sizeError !== null) {
            return response()->json(['message' => $sizeError], 413);
        }
        $content = $this->getCsvContent($request);
        if ($content === null) {
            return response()->json(['message' => 'No CSV file provided.'], 422);
        }

        $parser = new ArisExpandedScheduleCsvParser;
        $parsed = $parser->parse($content);
        $service = new ScheduleImportService;
        $rows = $service->filterLeaveRows($parsed['rows']);
        $fileLastModifiedMs = $this->parseFileLastModifiedMs($request);
        $service->storeLatestMasterCsvIfEligible($content, $rows, $request->user(), 'admin', $fileLastModifiedMs);
        $compare = $service->compareMasterCsv($parsed['rows']);

        $fileLastModified = $request->input('file_last_modified');
        $runAt = now();
        $payload = [
            'users' => $compare['users'],
            'past_count' => $compare['past_count'],
            'unmatched_employees' => $compare['unmatched_employees'] ?? [],
        ];
        if ($fileLastModified !== null && $fileLastModified !== '') {
            $lastRun = [
                'file_last_modified_ms' => (int) $fileLastModified,
                'run_at_iso' => $runAt->toIso8601String(),
                'users' => $compare['users'],
                'unmatched_employees' => $compare['unmatched_employees'] ?? [],
            ];
            Setting::set('bulk_compare_latest', json_encode($lastRun));
            $payload['last_bulk_compare'] = $lastRun;
        }

        return response()->json($payload);
    }

    public function masterApply(Request $request): JsonResponse
    {
        set_time_limit(120);
        $sizeError = $this->checkCsvSize($request);
        if ($sizeError !== null) {
            return response()->json(['message' => $sizeError], 413);
        }
        $content = $this->getCsvContent($request);
        if ($content === null) {
            return response()->json(['message' => 'No CSV file provided.'], 422);
        }

        $parser = new ArisExpandedScheduleCsvParser;
        $parsed = $parser->parse($content);
        $messageUsers = $request->boolean('message_users');
        $onlyUserIds = null;
        if ($request->has('user_ids')) {
            $raw = $request->input('user_ids');
            $ids = is_array($raw) ? $raw : explode(',', (string) $raw);
            $onlyUserIds = array_values(array_unique(array_filter(array_map('intval', $ids))));
            if (count($onlyUserIds) === 0) {
                return response()->json(['message' => 'Select at least one user to push, or clear the selection to apply to everyone in the file.'], 422);
            }
        }
        $service = new ScheduleImportService;
        $result = $service->applyMasterCsv($parsed['rows'], $request->user(), $messageUsers, $onlyUserIds);

        return response()->json($result);
    }

    private function checkCsvSize(Request $request): ?string
    {
        $max = ScheduleImportService::MAX_CSV_BYTES;
        if ($request->hasFile('file')) {
            $size = $request->file('file')->getSize();
            if ($size !== false && $size > $max) {
                return 'File too large. Maximum size is 50 MB.';
            }
        }
        if ($request->hasFile('csv')) {
            $size = $request->file('csv')->getSize();
            if ($size !== false && $size > $max) {
                return 'File too large. Maximum size is 50 MB.';
            }
        }
        $content = $request->input('csv_content');
        if (is_string($content) && strlen($content) > $max) {
            return 'File too large. Maximum size is 50 MB.';
        }

        return null;
    }

    private function getCsvContent(Request $request): ?string
    {
        $upload = $request->file('file') ?? $request->file('csv');
        if ($upload && $upload->isValid()) {
            $mime = $upload->getMimeType();
            if (in_array($mime, ['text/csv', 'text/plain', 'application/csv'], true)) {
                $raw = $upload->get();

                return is_string($raw) && $raw !== '' ? $raw : null;
            }

            return null;
        }
        $content = $request->input('csv_content');
        if (is_string($content) && $content !== '') {
            return $content;
        }

        return null;
    }

    private function parseFileLastModifiedMs(Request $request): ?int
    {
        $v = $request->input('file_last_modified');
        if ($v === null || $v === '') {
            return null;
        }
        if (is_numeric($v)) {
            $ms = (int) $v;

            return $ms > 0 ? $ms : null;
        }

        return null;
    }
}
