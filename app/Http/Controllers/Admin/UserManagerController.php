<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Models\Workgroup;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class UserManagerController extends Controller
{
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
            'password' => $request->input('password'),
            'role' => $request->input('role'),
            'time_display_preference' => $request->input('time_display_preference'),
            'phone' => $request->input('phone') ? trim($request->input('phone')) : null,
            'preferred_contact_method' => $request->input('preferred_contact_method') ?: 'email',
        ]);
        $workgroups = $request->input('workgroups', []);
        $sync = [];
        foreach ($workgroups as $w) {
            $sync[(int) $w['workgroup_id']] = [
                'classification_seniority_date' => $w['classification_seniority_date'] ?? null,
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
        if ($request->has('role')) {
            $updates['role'] = $request->input('role');
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
            ];
        }
        $user->workgroups()->sync($sync);
        $this->syncWorkgroupQualifications($user, $workgroups);
        return redirect()->route('admin.users')->with('success', 'User updated.');
    }

    private function syncWorkgroupQualifications(User $user, array $workgroupsPayload): void
    {
        $assignedWorkgroupIds = array_map(fn ($w) => (int) ($w['workgroup_id'] ?? 0), $workgroupsPayload);
        $validQualificationIds = \App\Models\WorkgroupQualification::whereIn('workgroup_id', $assignedWorkgroupIds)
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
