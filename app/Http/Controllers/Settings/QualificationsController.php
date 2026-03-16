<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\WorkgroupQualification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QualificationsController extends Controller
{
    /**
     * Show qualifications for workgroups the user belongs to. Users can only add/remove
     * qualifications that belong to their workgroups.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $user->load(['workgroups.qualifications', 'workgroupQualifications']);

        $workgroups = $user->workgroups->map(function ($wg) use ($user) {
            $userQualIds = $user->workgroupQualifications->where('workgroup_id', $wg->id)->pluck('id')->all();

            return [
                'id' => $wg->id,
                'name' => $wg->name,
                'qualifications' => $wg->qualifications->map(fn ($q) => [
                    'id' => $q->id,
                    'code' => $q->code,
                    'label' => $q->label,
                    'selected' => in_array($q->id, $userQualIds, true),
                ])->values()->all(),
            ];
        })->values()->all();

        return Inertia::render('settings/qualifications', [
            'workgroups' => $workgroups,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's qualifications. Only qualification IDs that belong to the user's
     * workgroups are accepted.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();
        $userWorkgroupIds = $user->workgroups()->pluck('id')->all();

        $validQualificationIds = WorkgroupQualification::whereIn('workgroup_id', $userWorkgroupIds)
            ->pluck('id')
            ->all();

        $rules = [
            'qualification_ids' => ['nullable', 'array'],
        ];
        if ($validQualificationIds !== []) {
            $rules['qualification_ids.*'] = ['integer', 'in:'.implode(',', $validQualificationIds)];
        }

        $validated = $request->validate($rules);

        $ids = array_values(array_unique(array_map('intval', $validated['qualification_ids'] ?? [])));
        $user->workgroupQualifications()->sync($ids);

        return redirect()->route('qualifications.edit')->with('status', 'Qualifications updated.');
    }
}
