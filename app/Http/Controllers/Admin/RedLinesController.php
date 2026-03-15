<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRedLineRequest;
use App\Http\Requests\Admin\UpdateRedLineRequest;
use App\Models\ClassificationRedLine;
use App\Models\Workgroup;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RedLinesController extends Controller
{
    public function index(): Response
    {
        $redLines = ClassificationRedLine::with(['workgroup' => fn ($q) => $q->with('users')])
            ->orderBy('workgroup_id')
            ->get()
            ->map(fn ($rl) => $this->mapRedLine($rl));

        $workgroups = Workgroup::orderBy('name')->get(['id', 'name']);

        return Inertia::render('admin/red-lines', [
            'redLines' => $redLines,
            'workgroups' => $workgroups,
        ]);
    }

    public function store(StoreRedLineRequest $request): RedirectResponse
    {
        ClassificationRedLine::create([
            'workgroup_id' => $request->input('workgroup_id'),
            'red_line_position' => $request->input('red_line_position'),
        ]);
        return redirect()->route('admin.red-lines')->with('success', 'Red line created.');
    }

    public function update(UpdateRedLineRequest $request, ClassificationRedLine $red_line): RedirectResponse
    {
        $red_line->update(['red_line_position' => $request->input('red_line_position')]);
        $aboveLineSeniority = $request->input('above_line_seniority', []);
        $workgroup = $red_line->workgroup;
        if ($workgroup) {
            foreach ($aboveLineSeniority as $item) {
                $userId = (int) ($item['user_id'] ?? 0);
                $number = isset($item['seniority_number']) ? (int) $item['seniority_number'] : null;
                if ($userId > 0) {
                    $workgroup->users()->updateExistingPivot($userId, [
                        'red_line_seniority_number' => $number ?: null,
                    ]);
                }
            }
        }
        return redirect()->route('admin.red-lines')->with('success', 'Red line updated.');
    }

    public function destroy(ClassificationRedLine $red_line): RedirectResponse
    {
        $red_line->delete();
        return redirect()->route('admin.red-lines')->with('success', 'Red line deleted.');
    }

    private function mapRedLine(ClassificationRedLine $rl): array
    {
        $workgroup = $rl->workgroup;
        if (! $workgroup) {
            return [
                'id' => $rl->id,
                'workgroup_id' => $rl->workgroup_id,
                'workgroup_name' => null,
                'red_line_position' => $rl->red_line_position,
                'users_above' => [],
                'users_below' => [],
            ];
        }
        $usersInWg = $workgroup->users->sortBy(function ($u) {
            $num = $u->pivot->red_line_seniority_number;
            $date = $u->pivot->classification_seniority_date ?? '9999-12-31';
            $sortNum = ($num !== null && $num !== '') ? (int) $num : 999999;
            return [$sortNum, $date];
        })->values();
        $position = (int) $rl->red_line_position;
        $above = $usersInWg->take($position)->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'seniority_number' => $u->pivot->red_line_seniority_number,
        ])->values()->all();
        $below = $usersInWg->skip($position)->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])->values()->all();
        return [
            'id' => $rl->id,
            'workgroup_id' => $rl->workgroup_id,
            'workgroup_name' => $workgroup->name,
            'red_line_position' => $rl->red_line_position,
            'users_above' => $above,
            'users_below' => $below,
        ];
    }
}
