<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ScheduleImportRun;
use App\Services\ScheduleImport\ArisExpandedScheduleCsvParser;
use App\Services\ScheduleImport\ScheduleImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScheduleImportController extends Controller
{
    public function preview(Request $request): JsonResponse
    {
        set_time_limit(120);
        $sizeError = $this->checkCsvSize($request);
        if ($sizeError !== null) {
            return response()->json(['message' => $sizeError], 413);
        }
        $content = $this->getCsvContent($request);
        if ($content === null) {
            return response()->json(['message' => 'No CSV file provided. Send a file (file or csv) or csv_content.'], 422);
        }

        $user = $request->user();
        if (empty($user->employee_id)) {
            return response()->json([
                'message' => 'Your account has no Employee ID set. Set it in Profile settings so we can match your schedule.',
            ], 422);
        }

        $parser = new ArisExpandedScheduleCsvParser;
        $parsed = $parser->parse($content);
        $rows = $parsed['rows'];
        $pastCount = $parsed['past_count'];
        $service = new ScheduleImportService;
        $rows = $service->filterLeaveRows($rows);
        $fileLastModifiedMs = $this->parseFileLastModifiedMs($request);
        $service->storeLatestMasterCsvIfEligible($content, $rows, $user, 'api', $fileLastModifiedMs);
        $myRows = array_values(array_filter($rows, fn (array $r) => (string) ($r['employee_id'] ?? '') === (string) $user->employee_id));

        if (count($myRows) === 0) {
            return response()->json([
                'preview' => [],
                'unmapped' => [],
                'errors' => ['No rows found for your Employee ID ('.$user->employee_id.'). Make sure the CSV export includes your row and your profile has the correct Employee ID.'],
                'past_count' => $pastCount,
            ]);
        }

        $result = $service->previewForUser($myRows, $user);
        $reconcile = $service->comparePreviewToBoard($result['preview'], $user);

        $userDeskTypes = $user->workgroups()
            ->with('deskTypes:id,workgroup_id,code,label,is_regulatory')
            ->get(['workgroups.id', 'workgroups.name'])
            ->map(fn ($wg) => [
                'workgroup_id' => $wg->id,
                'workgroup_name' => $wg->name,
                'desk_types' => $wg->deskTypes->map(fn ($d) => ['code' => $d->code, 'label' => $d->label, 'is_regulatory' => $d->is_regulatory])->values()->all(),
            ])
            ->values()
            ->all();

        return response()->json([
            'preview' => $result['preview'],
            'unmapped' => $result['unmapped'],
            'errors' => $result['errors'],
            'past_count' => $pastCount,
            'user_desk_types' => $userDeskTypes,
            'reconcile' => [
                'to_add' => $reconcile['to_add'],
                'to_remove' => $reconcile['to_remove'],
                'to_modify' => $reconcile['to_modify'],
            ],
        ]);
    }

    public function apply(Request $request): JsonResponse
    {
        set_time_limit(120);
        $user = $request->user();
        if (empty($user->employee_id)) {
            return response()->json([
                'message' => 'Your account has no Employee ID set. Set it in Profile settings first.',
            ], 422);
        }

        $myRows = null;
        $pastCount = 0;
        $rowsToApply = $request->input('rows_to_apply');
        if (is_array($rowsToApply) && count($rowsToApply) > 0) {
            $myRows = [];
            $tz = new \DateTimeZone(ScheduleImportService::TIMEZONE);
            $monthStart = (new \DateTimeImmutable('now', $tz))->format('Y-m-01');
            foreach ($rowsToApply as $r) {
                $date = $r['shift_date'] ?? '';
                $timeCode = $r['time_code'] ?? '';
                $desk = $r['desk_code'] ?? '';
                if ($date !== '' && $timeCode !== '' && $desk !== '') {
                    if (! empty($r['in_past']) || $date < $monthStart) {
                        continue;
                    }
                    $row = [
                        'employee_id' => $user->employee_id,
                        'employee_name' => $user->name,
                        'qualifications' => $r['qualifications'] ?? [],
                        'shift_date' => $date,
                        'time_code' => $timeCode,
                        'desk_code' => $desk,
                    ];
                    if (isset($r['workgroup_id']) && isset($r['desk_type'])) {
                        $row['workgroup_id'] = (int) $r['workgroup_id'];
                        $row['desk_type'] = $r['desk_type'];
                    }
                    $myRows[] = $row;
                }
            }
        }

        if ($myRows === null) {
            $sizeError = $this->checkCsvSize($request);
            if ($sizeError !== null) {
                return response()->json(['message' => $sizeError], 413);
            }
            $content = $this->getCsvContent($request);
            if ($content === null) {
                return response()->json(['message' => 'No CSV file provided. Send a file (file or csv) or csv_content.'], 422);
            }

            $parser = new ArisExpandedScheduleCsvParser;
            $parsed = $parser->parse($content);
            $rows = $parsed['rows'];
            $pastCount = $parsed['past_count'];
            $service = new ScheduleImportService;
            $rows = $service->filterLeaveRows($rows);
            $fileLastModifiedMs = $this->parseFileLastModifiedMs($request);
            $service->storeLatestMasterCsvIfEligible($content, $rows, $user, 'api', $fileLastModifiedMs);
            $myRows = array_values(array_filter($rows, fn (array $r) => (string) ($r['employee_id'] ?? '') === (string) $user->employee_id));
        }

        if (count($myRows) === 0) {
            return response()->json([
                'message' => 'No rows found for your Employee ID. Nothing to apply.',
                'run_id' => null,
                'created' => 0,
                'updated' => 0,
                'skipped' => 0,
                'conflict' => 0,
                'missing_shift_ids' => [],
                'past_count' => $pastCount,
            ]);
        }

        $service = new ScheduleImportService;
        $result = $service->applyForUser($myRows, $user, 'user');

        return response()->json([
            'message' => 'Import applied.',
            'run_id' => $result['run']->id,
            'created' => $result['created'],
            'updated' => $result['updated'],
            'skipped' => $result['skipped'],
            'conflict' => $result['conflict'],
            'missing_shift_ids' => $result['missing_shift_ids'],
            'missing_shifts' => $result['missing_shifts'],
            'past_count' => $pastCount,
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        $runs = ScheduleImportRun::where('target_user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn ($run) => [
                'id' => $run->id,
                'created_at' => $run->created_at->toIso8601String(),
                'created_count' => $run->created_count,
                'updated_count' => $run->updated_count,
                'skipped_count' => $run->skipped_count,
                'conflict_count' => $run->conflict_count,
                'missing_count' => $run->missing_count,
            ]);

        return response()->json(['runs' => $runs]);
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
