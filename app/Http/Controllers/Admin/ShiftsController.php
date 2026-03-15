<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\User;
use App\Models\Workgroup;
use App\Models\WorkgroupPositionRange;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

class ShiftsController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Shift::with(['user:id,name,email', 'workgroup:id,name']);

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }
        if ($request->filled('user_ids')) {
            $ids = is_array($request->input('user_ids')) ? $request->input('user_ids') : explode(',', $request->input('user_ids'));
            $query->whereIn('user_id', array_map('intval', $ids));
        }
        if ($request->filled('date_from')) {
            $query->where('end_time_utc', '>=', Carbon::parse($request->input('date_from'))->startOfDay()->utc());
        }
        if ($request->filled('date_to')) {
            $query->where('start_time_utc', '<=', Carbon::parse($request->input('date_to'))->endOfDay()->utc());
        }
        if ($request->filled('workgroup_id')) {
            $query->where('workgroup_id', $request->input('workgroup_id'));
        }

        $shifts = $query->orderBy('start_time_utc', 'desc')->limit(500)->get()->map(fn ($s) => [
            'id' => $s->id,
            'user_id' => $s->user_id,
            'user_name' => $s->user?->name,
            'user_email' => $s->user?->email,
            'workgroup_id' => $s->workgroup_id,
            'workgroup_name' => $s->workgroup?->name,
            'position_name' => $s->position_name,
            'desk_type' => $s->desk_type,
            'start_time_utc' => $s->start_time_utc->toIso8601String(),
            'end_time_utc' => $s->end_time_utc->toIso8601String(),
            'regulatory' => $s->regulatory,
        ]);

        $users = User::with('workgroups:id')->orderBy('name')->get(['id', 'name', 'email'])->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'workgroup_ids' => $u->workgroups->pluck('id')->values()->all(),
        ]);

        $workgroups = Workgroup::with(['allowedStartTimes', 'deskTypes', 'positionRanges.deskType'])->orderBy('name')->get()->map(function ($wg) {
            $positions = WorkgroupPositionRange::expandRangesToPositions($wg->positionRanges);
            $allowedStartTimes = $wg->allowedStartTimes
                ->sortBy(fn ($t) => is_object($t->start_time) ? $t->start_time->format('H:i') : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5))
                ->values()
                ->map(fn ($t) => [
                    'start_time' => is_object($t->start_time) ? $t->start_time->format('H:i') : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5),
                    'default_duration_minutes' => (int) $t->default_duration_minutes,
                ])->values()->all();
            return [
                'id' => $wg->id,
                'name' => $wg->name,
                'allowed_start_times' => $allowedStartTimes,
                'desk_types' => $wg->deskTypes->map(fn ($d) => ['code' => $d->code, 'label' => $d->label])->values()->all(),
                'positions' => $positions,
            ];
        });

        return Inertia::render('admin/shifts', [
            'shifts' => $shifts,
            'users' => $users,
            'workgroups' => $workgroups,
            'filters' => $request->only(['user_id', 'user_ids', 'date_from', 'date_to', 'workgroup_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'workgroup_id' => ['required', 'integer', 'exists:workgroups,id'],
            'position_name' => ['required', 'string', 'max:255'],
            'desk_type' => ['nullable', 'string', 'max:64'],
            'start_date' => ['required', 'date'],
            'start_time' => ['required', 'string', 'regex:/^\d{1,2}:\d{2}(?::\d{2})?$/'],
            'end_date' => ['nullable', 'date'],
            'end_time' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}(?::\d{2})?$/'],
            'regulatory' => ['boolean'],
        ]);
        if ($validator->fails()) {
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $userId = (int) $request->input('user_id');
        $workgroupId = (int) $request->input('workgroup_id');

        $user = User::findOrFail($userId);
        if (! $user->workgroups()->where('workgroup_id', $workgroupId)->exists()) {
            return redirect()->back()->withErrors(['workgroup_id' => 'This user is not in the selected workgroup. Users can only receive shifts for workgroups they belong to.'])->withInput();
        }

        $start = Carbon::parse($request->input('start_date') . ' ' . $request->input('start_time'), 'America/Chicago')->utc();

        $endDate = $request->input('end_date');
        $endTime = $request->input('end_time');
        if ($endDate && $endTime) {
            $end = Carbon::parse($endDate . ' ' . $endTime, 'America/Chicago')->utc();
            if ($end->lte($start)) {
                return redirect()->back()->withErrors(['end_time' => 'End must be after start.'])->withInput();
            }
        } else {
            $workgroup = Workgroup::with('allowedStartTimes')->find($workgroupId);
            $startTimeNormalized = Carbon::parse('1970-01-01 ' . $request->input('start_time'))->format('H:i');
            $allowed = $workgroup?->allowedStartTimes->first(function ($t) use ($startTimeNormalized) {
                $tStr = $t->start_time instanceof Carbon ? $t->start_time->format('H:i') : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5);
                return $tStr === $startTimeNormalized;
            });
            if (! $allowed) {
                return redirect()->back()->withErrors(['start_time' => 'Start time must be an allowed start time for this workgroup, or provide end date/time.'])->withInput();
            }
            $end = $start->copy()->addMinutes((int) $allowed->default_duration_minutes);
        }

        Shift::create([
            'user_id' => $userId,
            'workgroup_id' => $workgroupId,
            'position_name' => $request->input('position_name'),
            'desk_type' => $request->input('desk_type'),
            'start_time_utc' => $start,
            'end_time_utc' => $end,
            'regulatory' => (bool) $request->input('regulatory', false),
        ]);

        return redirect()->route('admin.shifts')->with('success', 'Shift added.');
    }

    /**
     * Add shifts by rotation pattern over a date range (for testing / quickly filling boards).
     * Pattern: comma-separated days, alternating work/off (e.g. "5,3,5,5" = work 5, off 3, work 5, off 5).
     * First day in range = day 1 of the first work block.
     */
    public function storeByRotation(Request $request): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'workgroup_id' => ['required', 'integer', 'exists:workgroups,id'],
            'position_name' => ['required', 'string', 'max:255'],
            'desk_type' => ['nullable', 'string', 'max:64'],
            'start_time' => ['required', 'string', 'regex:/^\d{1,2}:\d{2}(?::\d{2})?$/'],
            'regulatory' => ['boolean'],
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'pattern' => ['required', 'string', 'regex:/^[\d\s,]+$/'],
        ]);
        if ($validator->fails()) {
            return redirect()->back()->withErrors($validator)->withInput();
        }

        $blocks = array_map('intval', array_filter(preg_split('/[\s,]+/', $request->input('pattern'))));
        if (count($blocks) < 2) {
            return redirect()->back()->withErrors(['pattern' => 'Pattern must have at least 2 values (e.g. 5,3,5,5 for work, off, work, off).'])->withInput();
        }

        $userId = (int) $request->input('user_id');
        $workgroupId = (int) $request->input('workgroup_id');
        $user = User::findOrFail($userId);
        if (! $user->workgroups()->where('workgroup_id', $workgroupId)->exists()) {
            return redirect()->back()->withErrors(['workgroup_id' => 'This user is not in the selected workgroup. Users can only receive shifts for workgroups they belong to.'])->withInput();
        }

        $workgroup = Workgroup::with('allowedStartTimes')->findOrFail($workgroupId);
        $startTimeNormalized = Carbon::parse('1970-01-01 ' . $request->input('start_time'))->format('H:i');
        $allowed = $workgroup->allowedStartTimes->first(function ($t) use ($startTimeNormalized) {
            $tStr = $t->start_time instanceof Carbon ? $t->start_time->format('H:i') : substr((string) ($t->getRawOriginal('start_time') ?? ''), 0, 5);
            return $tStr === $startTimeNormalized;
        });
        if (! $allowed) {
            return redirect()->back()->withErrors(['start_time' => 'Start time must be an allowed start time for this workgroup.'])->withInput();
        }

        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->startOfDay();
        $durationMinutes = (int) $allowed->default_duration_minutes;

        $cycleLength = array_sum($blocks);
        $created = 0;
        $current = $dateFrom->copy();
        $dayIndex = 0;

        while ($current->lte($dateTo)) {
            $posInCycle = $dayIndex % $cycleLength;
            $cumulative = 0;
            $isWork = false;
            foreach ($blocks as $i => $len) {
                if ($posInCycle < $cumulative + $len) {
                    $isWork = ($i % 2 === 0);
                    break;
                }
                $cumulative += $len;
            }
            if ($isWork) {
                $start = Carbon::parse($current->format('Y-m-d') . ' ' . $request->input('start_time'), 'America/Chicago')->utc();
                $end = $start->copy()->addMinutes($durationMinutes);
                Shift::create([
                    'user_id' => (int) $request->input('user_id'),
                    'workgroup_id' => (int) $request->input('workgroup_id'),
                    'position_name' => $request->input('position_name'),
                    'desk_type' => $request->input('desk_type'),
                    'start_time_utc' => $start,
                    'end_time_utc' => $end,
                    'regulatory' => (bool) $request->input('regulatory', false),
                ]);
                $created++;
            }
            $current->addDay();
            $dayIndex++;
        }

        return redirect()->route('admin.shifts')->with('success', "{$created} shift(s) added by rotation.");
    }

    public function destroy(Shift $shift): RedirectResponse
    {
        $shift->delete();
        return redirect()->back()->with('success', 'Shift deleted.');
    }

    public function bulkDestroy(Request $request): RedirectResponse
    {
        $ids = $request->input('shift_ids', []);
        if (! is_array($ids)) {
            $ids = [];
        }
        $count = Shift::whereIn('id', array_map('intval', $ids))->delete();
        return redirect()->back()->with('success', "{$count} shift(s) deleted.");
    }

    public function bulkMove(Request $request): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'shift_ids' => ['required', 'array', 'min:1'],
            'shift_ids.*' => ['integer', 'exists:shifts,id'],
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);
        if ($validator->fails()) {
            return redirect()->back()->withErrors($validator);
        }

        $userId = (int) $request->input('user_id');
        $ids = array_map('intval', $request->input('shift_ids'));
        $user = User::with('workgroups:id')->findOrFail($userId);
        $userWorkgroupIds = $user->workgroups->pluck('id')->all();

        $shifts = Shift::whereIn('id', $ids)->get(['id', 'workgroup_id']);
        $invalid = $shifts->filter(fn ($s) => ! in_array($s->workgroup_id, $userWorkgroupIds, true));
        if ($invalid->isNotEmpty()) {
            return redirect()->back()->withErrors(['user_id' => 'The selected user is not in the workgroup for one or more of these shifts. Users can only receive shifts for workgroups they belong to.'])->withInput();
        }

        $count = Shift::whereIn('id', $ids)->update(['user_id' => $userId]);
        return redirect()->back()->with('success', "{$count} shift(s) moved.");
    }
}
