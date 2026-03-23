<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DestroyUserRequest;
use App\Http\Requests\Admin\ImportUsersRequest;
use App\Http\Requests\Admin\ResetUserPasswordToDefaultRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Models\Workgroup;
use App\Models\WorkgroupQualification;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

class UserManagerController extends Controller
{
    private const IMPORT_MAX_ROWS = 500;

    public function index(): Response
    {
        $users = User::with(['workgroups' => fn ($q) => $q->withPivot('classification_seniority_date'), 'workgroupQualifications'])
            ->orderBy('name')
            ->get()
            ->map(function (User $u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'employee_id' => $u->employee_id,
                    'phone' => $u->phone,
                    'preferred_contact_method' => $u->preferred_contact_method,
                    'role' => $u->role,
                    'time_display_preference' => $u->time_display_preference,
                    'workgroups' => $u->workgroups->map(fn ($wg) => [
                        'id' => $wg->id,
                        'name' => $wg->name,
                        'classification_seniority_date' => $this->formatPivotDate($wg->pivot->classification_seniority_date),
                        'qualification_ids' => $u->workgroupQualifications->where('workgroup_id', $wg->id)->pluck('id')->values()->all(),
                    ]),
                ];
            });

        $workgroups = Workgroup::with('qualifications')->orderBy('name')->get()->map(fn ($wg) => [
            'id' => $wg->id,
            'name' => $wg->name,
            'qualifications' => $wg->qualifications->map(fn ($q) => ['id' => $q->id, 'code' => $q->code, 'label' => $q->label])->values()->all(),
        ]);

        return Inertia::render('admin/users', [
            'users' => $users,
            'workgroups' => $workgroups,
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $user = User::create([
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'employee_id' => $request->input('employee_id'),
            'password' => (string) config('admin.default_user_password'),
            'time_display_preference' => $request->input('time_display_preference'),
            'phone' => $request->input('phone') ? trim($request->input('phone')) : null,
            'preferred_contact_method' => $request->input('preferred_contact_method') ?: 'email',
        ]);
        $user->role = $request->input('role');
        $user->save();
        $workgroups = $request->input('workgroups', []);
        $sync = [];
        foreach ($workgroups as $w) {
            $sync[(int) $w['workgroup_id']] = [
                'classification_seniority_date' => $w['classification_seniority_date'] ?? null,
                'dispatch_qualified' => false,
            ];
        }
        $user->workgroups()->sync($sync);
        $this->syncWorkgroupQualifications($user, $workgroups);

        return redirect()->route('admin.users')->with('success', 'User created.');
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $updates = [];
        if ($request->has('name')) {
            $updates['name'] = $request->input('name');
        }
        if ($request->has('email')) {
            $updates['email'] = $request->input('email');
        }
        if ($request->has('employee_id')) {
            $updates['employee_id'] = $request->input('employee_id') ?: null;
        }
        if ($request->has('role')) {
            $user->role = $request->input('role');
            $user->save();
        }
        if ($request->has('time_display_preference')) {
            $updates['time_display_preference'] = $request->input('time_display_preference');
        }
        if ($request->has('phone')) {
            $updates['phone'] = $request->input('phone') ? trim($request->input('phone')) : null;
        }
        if ($request->has('preferred_contact_method')) {
            $updates['preferred_contact_method'] = $request->input('preferred_contact_method') ?: 'email';
        }
        if ($updates !== []) {
            $user->update($updates);
        }
        $workgroups = $request->input('workgroups', []);
        $sync = [];
        foreach ($workgroups as $w) {
            $sync[(int) $w['workgroup_id']] = [
                'classification_seniority_date' => $w['classification_seniority_date'] ?? null,
                'dispatch_qualified' => false,
            ];
        }
        $user->workgroups()->sync($sync);
        $this->syncWorkgroupQualifications($user, $workgroups);

        return redirect()->route('admin.users')->with('success', 'User updated.');
    }

    public function resetPasswordToDefault(ResetUserPasswordToDefaultRequest $request, User $user): RedirectResponse
    {
        $user->password = (string) config('admin.default_user_password');
        $user->save();

        return redirect()->route('admin.users')->with(
            'success',
            'Password reset to the default initial password. Ask the user to sign in and change it under account settings.'
        );
    }

    public function destroy(DestroyUserRequest $request, User $user): RedirectResponse
    {
        $user->delete();

        return redirect()->route('admin.users')->with('success', 'User deleted.');
    }

    public function import(ImportUsersRequest $request): RedirectResponse
    {
        $raw = $this->getImportCsvContent($request);
        if ($raw === null || $raw === '') {
            return redirect()->route('admin.users')->with('error', 'No CSV content could be read.');
        }

        try {
            $parsed = $this->parseUserImportCsv($raw);
        } catch (\InvalidArgumentException $e) {
            return redirect()->route('admin.users')->with('error', $e->getMessage());
        }

        if ($parsed->isEmpty()) {
            return redirect()->route('admin.users')->with('error', 'The CSV has no data rows.');
        }

        if ($parsed->count() > self::IMPORT_MAX_ROWS) {
            return redirect()->route('admin.users')->with('error', 'Too many rows. Maximum is '.self::IMPORT_MAX_ROWS.' users per import.');
        }

        $password = (string) config('admin.default_user_password');
        $workgroupIdsByLowerName = Workgroup::query()
            ->orderBy('name')
            ->get()
            ->mapWithKeys(fn (Workgroup $wg) => [strtolower(trim($wg->name)) => $wg->id]);

        $existingEmailKeys = User::query()->pluck('email')->mapWithKeys(fn ($e) => [strtolower((string) $e) => true]);
        $empIdsForLookup = $parsed->pluck('employee_id')->filter()->values()->all();
        $existingEmployeeIds = $empIdsForLookup === []
            ? collect()
            : User::whereIn('employee_id', $empIdsForLookup)
                ->pluck('employee_id')
                ->mapWithKeys(fn ($id) => [(string) $id => true]);

        $seenEmails = [];
        $seenEmployeeIds = [];
        $created = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($parsed as $row) {
            $emailKey = strtolower($row['email']);
            if (isset($seenEmails[$emailKey]) || isset($existingEmailKeys[$emailKey])) {
                $skipped++;

                continue;
            }
            $seenEmails[$emailKey] = true;

            $empId = $row['employee_id'];
            if ($empId !== null && $empId !== '') {
                if (isset($seenEmployeeIds[$empId]) || $existingEmployeeIds->has($empId)) {
                    $skipped++;

                    continue;
                }
                $seenEmployeeIds[$empId] = true;
            }

            $v = Validator::make(
                [
                    'name' => $row['name'],
                    'email' => $row['email'],
                    'employee_id' => $row['employee_id'],
                    'phone' => $row['phone'],
                    'role' => $row['role'],
                ],
                [
                    'name' => ['required', 'string', 'max:255'],
                    'email' => ['required', 'string', 'email', 'max:255'],
                    'employee_id' => ['nullable', 'string', 'max:30'],
                    'phone' => ['nullable', 'string', 'max:50'],
                    'role' => ['required', 'string', 'in:worker,manager,admin'],
                ]
            );
            if ($v->fails()) {
                $failed++;

                continue;
            }

            $workgroupIds = $this->resolveImportWorkgroupIds($row['workgroups_raw'] ?? '', $workgroupIdsByLowerName);
            if ($workgroupIds === null) {
                $failed++;

                continue;
            }

            $user = User::create([
                'name' => $v->validated()['name'],
                'email' => $v->validated()['email'],
                'employee_id' => $v->validated()['employee_id'] ?: null,
                'password' => $password,
                'time_display_preference' => 'central',
                'phone' => $v->validated()['phone'] ? trim((string) $v->validated()['phone']) : null,
                'preferred_contact_method' => 'email',
            ]);
            $user->role = $v->validated()['role'];
            $user->save();

            $sync = [];
            foreach ($workgroupIds as $wgId) {
                $sync[$wgId] = [
                    'classification_seniority_date' => null,
                    'dispatch_qualified' => false,
                ];
            }
            $user->workgroups()->sync($sync);
            $workgroupsPayload = array_map(
                fn (int $id) => ['workgroup_id' => $id, 'qualification_ids' => []],
                $workgroupIds
            );
            $this->syncWorkgroupQualifications($user, $workgroupsPayload);

            $created++;
        }

        $parts = ["{$created} created"];
        if ($skipped > 0) {
            $parts[] = "{$skipped} skipped (duplicate email or employee ID)";
        }
        if ($failed > 0) {
            $parts[] = "{$failed} failed (validation or unknown workgroup name)";
        }

        return redirect()->route('admin.users')->with('success', 'Import complete: '.implode(', ', $parts).'.');
    }

    private function getImportCsvContent(ImportUsersRequest $request): ?string
    {
        $upload = $request->file('file');
        if ($upload && $upload->isValid()) {
            $raw = $upload->get();

            return is_string($raw) && $raw !== '' ? $raw : null;
        }
        $content = $request->input('csv_content');
        if (is_string($content) && trim($content) !== '') {
            return $content;
        }

        return null;
    }

    /**
     * @return Collection<int, array{name: string, email: string, employee_id: string|null, phone: string|null, role: string, workgroups_raw: string}>
     */
    private function parseUserImportCsv(string $content): Collection
    {
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content) ?? $content;
        $lines = preg_split('/\r\n|\r|\n/', $content);
        $rows = [];
        foreach ($lines as $line) {
            if (trim((string) $line) === '') {
                continue;
            }
            $rows[] = str_getcsv((string) $line);
        }
        if ($rows === []) {
            return collect();
        }

        $header = array_map(fn ($h) => strtolower(trim((string) $h)), array_shift($rows));
        $idx = [];
        foreach ($header as $i => $name) {
            if ($name !== '') {
                $idx[$name] = $i;
            }
        }
        if (! isset($idx['name'], $idx['email'])) {
            throw new \InvalidArgumentException('CSV must have a header row with name and email columns.');
        }

        $wgKey = $idx['workgroups'] ?? $idx['workgroup'] ?? null;
        if ($wgKey === null) {
            throw new \InvalidArgumentException('CSV must include a workgroups column (or workgroup for a single assignment).');
        }

        $out = collect();
        foreach ($rows as $cells) {
            $name = trim((string) ($cells[$idx['name']] ?? ''));
            $email = trim((string) ($cells[$idx['email']] ?? ''));
            if ($name === '' && $email === '') {
                continue;
            }
            $workgroupsRaw = trim((string) ($cells[$wgKey] ?? ''));
            $empKey = $idx['employee_id'] ?? $idx['empid'] ?? $idx['employee id'] ?? $idx['emp_id'] ?? null;
            $phoneKey = $idx['phone'] ?? null;
            $roleKey = $idx['role'] ?? null;
            $employeeId = null;
            if ($empKey !== null && isset($cells[$empKey])) {
                $employeeId = trim((string) $cells[$empKey]);
                $employeeId = $employeeId === '' ? null : $employeeId;
            }
            $phone = null;
            if ($phoneKey !== null && isset($cells[$phoneKey])) {
                $p = trim((string) $cells[$phoneKey]);
                $phone = $p === '' ? null : $p;
            }
            $role = 'worker';
            if ($roleKey !== null && isset($cells[$roleKey])) {
                $r = strtolower(trim((string) $cells[$roleKey]));
                if (in_array($r, ['worker', 'manager', 'admin'], true)) {
                    $role = $r;
                }
            }

            $out->push([
                'name' => $name,
                'email' => $email,
                'employee_id' => $employeeId,
                'phone' => $phone,
                'role' => $role,
                'workgroups_raw' => $workgroupsRaw,
            ]);
        }

        return $out;
    }

    /**
     * @param  Collection<string, int>  $workgroupIdsByLowerName
     * @return list<int>|null
     */
    private function resolveImportWorkgroupIds(string $raw, Collection $workgroupIdsByLowerName): ?array
    {
        $names = $this->splitImportWorkgroupNames($raw);
        if ($names === []) {
            return [];
        }

        $ids = [];
        foreach ($names as $name) {
            $key = strtolower(trim($name));
            if (! $workgroupIdsByLowerName->has($key)) {
                return null;
            }
            $ids[] = (int) $workgroupIdsByLowerName->get($key);
        }

        return array_values(array_unique($ids));
    }

    /**
     * @return list<string>
     */
    private function splitImportWorkgroupNames(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $parts = preg_split('/\s*[,;]\s*/', $raw) ?: [];
        $out = [];
        foreach ($parts as $part) {
            $t = trim((string) $part);
            if ($t !== '') {
                $out[] = $t;
            }
        }

        return $out;
    }

    private function syncWorkgroupQualifications(User $user, array $workgroupsPayload): void
    {
        $assignedWorkgroupIds = array_map(fn ($w) => (int) ($w['workgroup_id'] ?? 0), $workgroupsPayload);
        $validQualificationIds = WorkgroupQualification::whereIn('workgroup_id', $assignedWorkgroupIds)
            ->pluck('id')
            ->all();
        $qualificationIds = [];
        foreach ($workgroupsPayload as $w) {
            foreach ($w['qualification_ids'] ?? [] as $qid) {
                $qid = (int) $qid;
                if (in_array($qid, $validQualificationIds, true)) {
                    $qualificationIds[] = $qid;
                }
            }
        }
        $user->workgroupQualifications()->sync(array_unique($qualificationIds));
    }

    private function formatPivotDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_object($value) && method_exists($value, 'format')) {
            return $value->format('Y-m-d');
        }
        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable) {
            return is_string($value) ? $value : null;
        }
    }
}
