<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreWorkgroupRequest;
use App\Http\Requests\Admin\UpdateWorkgroupRequest;
use App\Models\Workgroup;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class WorkgroupsController extends Controller
{
    public function index(): Response
    {
        $workgroups = $this->mapWorkgroups(Workgroup::with(['allowedStartTimes', 'positionRanges.deskType', 'deskTypes.qualification', 'qualifications'])->orderBy('name')->get());

        return Inertia::render('admin/workgroups', [
            'workgroups' => $workgroups,
        ]);
    }

    public function store(StoreWorkgroupRequest $request): RedirectResponse
    {
        $wg = Workgroup::create([
            'name' => $request->input('name'),
            'regulatory' => $request->boolean('regulatory'),
            'max_hours_per_day' => $request->input('max_hours_per_day'),
            'rest_required_hours' => $request->input('rest_required_hours'),
            'allow_double' => $request->boolean('allow_double'),
        ]);
        $this->syncAllowedStartTimes($wg, $request->input('allowed_start_times', []));
        $this->syncQualifications($wg, $request->input('qualifications', []));
        $this->syncDeskTypes($wg, $request->input('desk_types', []));
        $this->syncPositionRanges($wg, $request->input('position_ranges', []));

        return redirect()->route('admin.workgroups')->with('success', 'Workgroup created.');
    }

    public function update(UpdateWorkgroupRequest $request, Workgroup $workgroup): RedirectResponse
    {
        $workgroup->update([
            'name' => $request->input('name'),
            'regulatory' => $request->boolean('regulatory'),
            'max_hours_per_day' => $request->input('max_hours_per_day'),
            'rest_required_hours' => $request->input('rest_required_hours'),
            'allow_double' => $request->boolean('allow_double'),
        ]);
        $this->syncAllowedStartTimes($workgroup, $request->input('allowed_start_times', []));
        $this->syncQualifications($workgroup, $request->input('qualifications', []));
        $this->syncDeskTypes($workgroup, $request->input('desk_types', []));
        $this->syncPositionRanges($workgroup, $request->input('position_ranges', []));

        return redirect()->route('admin.workgroups')->with('success', 'Workgroup updated.');
    }

    public function destroy(Workgroup $workgroup): RedirectResponse
    {
        $workgroup->delete();

        return redirect()->route('admin.workgroups')->with('success', 'Workgroup deleted.');
    }

    private function syncAllowedStartTimes(Workgroup $wg, array $times): void
    {
        $wg->allowedStartTimes()->delete();
        foreach ($times as $t) {
            $start = $t['start_time'] ?? '';
            if (strlen($start) === 5) {
                $start .= ':00';
            }
            $wg->allowedStartTimes()->create([
                'start_time' => $start,
                'default_duration_minutes' => (int) ($t['default_duration_minutes'] ?? 510),
            ]);
        }
    }

    private function syncDeskTypes(Workgroup $wg, array $deskTypes): void
    {
        $wg->deskTypes()->delete();
        $qualByCode = $wg->qualifications()->get()->keyBy('code');
        foreach ($deskTypes as $i => $dt) {
            $code = trim($dt['code'] ?? '');
            if ($code === '') {
                continue;
            }
            $qualCode = $dt['workgroup_qualification_code'] ?? null;
            $qualId = $qualCode && $qualByCode->has($qualCode) ? $qualByCode->get($qualCode)->id : null;
            $wg->deskTypes()->create([
                'code' => $code,
                'label' => trim($dt['label'] ?? $code),
                'workgroup_qualification_id' => $qualId,
                'sort_order' => $i,
            ]);
        }
    }

    private function syncPositionRanges(Workgroup $wg, array $ranges): void
    {
        $wg->positionRanges()->delete();
        $deskTypesByCode = $wg->deskTypes()->get()->keyBy('code');
        foreach ($ranges as $i => $r) {
            $rangeSpec = trim($r['range_spec'] ?? '');
            if ($rangeSpec === '') {
                continue;
            }
            $deskTypeCode = $r['desk_type_code'] ?? 'extra';
            $deskType = $deskTypesByCode->get($deskTypeCode);
            $wg->positionRanges()->create([
                'range_spec' => $rangeSpec,
                'parity' => $r['parity'] ?? null,
                'workgroup_desk_type_id' => $deskType?->id,
                'sort_order' => $i,
            ]);
        }
    }

    private function syncQualifications(Workgroup $wg, array $qualifications): void
    {
        $wg->qualifications()->delete();
        foreach ($qualifications as $i => $q) {
            $wg->qualifications()->create([
                'code' => $q['code'] ?? '',
                'label' => $q['label'] ?? '',
                'sort_order' => $i,
            ]);
        }
    }

    private function mapWorkgroups($collection)
    {
        return $collection->map(fn ($wg) => [
            'id' => $wg->id,
            'name' => $wg->name,
            'regulatory' => $wg->regulatory,
            'max_hours_per_day' => $wg->max_hours_per_day,
            'rest_required_hours' => $wg->rest_required_hours,
            'allow_double' => $wg->allow_double,
            'allowed_start_times' => $wg->allowedStartTimes
                ->sortBy(function ($t) {
                    $raw = is_object($t->start_time) ? $t->start_time->format('H:i') : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5);
                    $parts = explode(':', $raw);

                    return sprintf('%02d:%02d', (int) ($parts[0] ?? 0), (int) ($parts[1] ?? 0));
                })
                ->values()
                ->map(fn ($t) => [
                    'id' => $t->id,
                    'start_time' => is_object($t->start_time) ? $t->start_time->format('H:i') : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5),
                    'default_duration_minutes' => $t->default_duration_minutes,
                ])
                ->values()
                ->all(),
            'desk_types' => $wg->deskTypes->map(fn ($dt) => [
                'id' => $dt->id,
                'code' => $dt->code,
                'label' => $dt->label,
                'workgroup_qualification_id' => $dt->workgroup_qualification_id,
                'workgroup_qualification_code' => $dt->qualification?->code,
            ])->values()->all(),
            'position_ranges' => $wg->positionRanges->map(fn ($r) => [
                'id' => $r->id,
                'range_spec' => $r->range_spec,
                'parity' => $r->parity,
                'desk_type_code' => $r->deskType?->code ?? 'extra',
            ])->values()->all(),
            'qualifications' => $wg->qualifications->map(fn ($q) => [
                'id' => $q->id,
                'code' => $q->code,
                'label' => $q->label,
            ])->values()->all(),
        ]);
    }
}
