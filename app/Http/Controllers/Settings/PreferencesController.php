<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\UserPreference;
use App\Models\WorkgroupDeskType;
use App\Services\PostEligibilityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PreferencesController extends Controller
{
    public static function deskTypeOptions(): array
    {
        return [
            ['value' => 'domestic_dispatch', 'label' => 'Domestic dispatch'],
            ['value' => 'assistant_desk', 'label' => 'Assistant desk'],
            ['value' => 'etops', 'label' => 'ETOPS'],
            ['value' => 'intl', 'label' => 'INTL'],
            ['value' => 'regional', 'label' => 'Regional (G)'],
            ['value' => 'sector', 'label' => 'Sector (S)'],
            ['value' => 'nextday', 'label' => 'NextDay (R)'],
            ['value' => 'extra', 'label' => 'Extra'],
        ];
    }

    public function __construct(
        protected PostEligibilityService $eligibility
    ) {}

    public function edit(Request $request): Response
    {
        $user = $request->user();
        $pref = UserPreference::firstOrCreate(
            ['user_id' => $user->id],
            [
                'preferred_shift_type' => null,
                'shift_start_time_min' => null,
                'shift_start_time_max' => null,
                'willing_double_am_pm' => false,
                'willing_double_pm_midnight' => false,
                'willing_double_midnight_am' => false,
                'double_gap_minutes_acceptable' => null,
                'max_doubles_in_row' => null,
                'hide_posts_that_would_be_double' => false,
                'desired_desk_types' => null,
            ]
        );

        $desired = $pref->desired_desk_types;
        if (! is_array($desired)) {
            $desired = [];
        }

        $byWorkgroup = $this->eligibility->getQualifiedDeskTypesByWorkgroup($user);
        $allOptionsMap = collect(self::deskTypeOptions())->keyBy('value');
        $deskTypeLabelsByWg = WorkgroupDeskType::whereIn('workgroup_id', array_column($byWorkgroup, 'workgroup_id'))
            ->get()
            ->groupBy('workgroup_id')
            ->map(fn ($types) => $types->keyBy('code')->map(fn ($t) => $t->label)->all())
            ->all();
        $desk_options_by_workgroup = array_map(function ($row) use ($allOptionsMap, $deskTypeLabelsByWg) {
            $options = [];
            $labels = $deskTypeLabelsByWg[$row['workgroup_id']] ?? [];
            foreach ($row['desk_types'] as $value) {
                $label = $labels[$value] ?? $allOptionsMap->get($value)['label'] ?? $value;
                $options[] = ['value' => $value, 'label' => $label];
            }

            return [
                'workgroup_id' => $row['workgroup_id'],
                'workgroup_name' => $row['workgroup_name'],
                'desk_type_options' => $options,
            ];
        }, $byWorkgroup);

        $shiftStartMin = $pref->shift_start_time_min;
        $shiftStartMax = $pref->shift_start_time_max;

        return Inertia::render('settings/preferences', [
            'desired_desk_types' => $desired,
            'desk_options_by_workgroup' => $desk_options_by_workgroup,
            'shift_start_time_min' => $shiftStartMin ? (is_string($shiftStartMin) ? substr($shiftStartMin, 0, 5) : $shiftStartMin->format('H:i')) : null,
            'shift_start_time_max' => $shiftStartMax ? (is_string($shiftStartMax) ? substr($shiftStartMax, 0, 5) : $shiftStartMax->format('H:i')) : null,
            'willing_double_am_pm' => (bool) $pref->willing_double_am_pm,
            'willing_double_pm_midnight' => (bool) $pref->willing_double_pm_midnight,
            'willing_double_midnight_am' => (bool) $pref->willing_double_midnight_am,
            'double_gap_minutes_acceptable' => $pref->double_gap_minutes_acceptable,
            'max_doubles_in_row' => $pref->max_doubles_in_row,
            'hide_posts_that_would_be_double' => (bool) $pref->hide_posts_that_would_be_double,
            'status' => $request->session()->get('status'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $request->merge([
            'double_gap_minutes_acceptable' => $request->input('double_gap_minutes_acceptable') === '' ? null : $request->input('double_gap_minutes_acceptable'),
            'max_doubles_in_row' => $request->input('max_doubles_in_row') === '' ? null : $request->input('max_doubles_in_row'),
            'shift_start_time_min' => $request->input('shift_start_time_min') === '' ? null : $request->input('shift_start_time_min'),
            'shift_start_time_max' => $request->input('shift_start_time_max') === '' ? null : $request->input('shift_start_time_max'),
        ]);
        $validated = $request->validate([
            'desired_desk_types' => ['nullable', 'array'],
            'desired_desk_types.*' => ['string', 'max:64'],
            'shift_start_time_min' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],
            'shift_start_time_max' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],
            'willing_double_am_pm' => ['boolean'],
            'willing_double_pm_midnight' => ['boolean'],
            'willing_double_midnight_am' => ['boolean'],
            'double_gap_minutes_acceptable' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'max_doubles_in_row' => ['nullable', 'integer', 'min:1', 'max:7'],
            'hide_posts_that_would_be_double' => ['boolean'],
        ]);

        $user = $request->user();
        $pref = UserPreference::firstOrCreate(
            ['user_id' => $user->id],
            [
                'preferred_shift_type' => null,
                'shift_start_time_min' => null,
                'shift_start_time_max' => null,
                'willing_double_am_pm' => false,
                'willing_double_pm_midnight' => false,
                'willing_double_midnight_am' => false,
                'double_gap_minutes_acceptable' => null,
                'max_doubles_in_row' => null,
                'hide_posts_that_would_be_double' => false,
                'desired_desk_types' => null,
            ]
        );

        $pref->desired_desk_types = $validated['desired_desk_types'] ?? [];
        $pref->shift_start_time_min = $this->parseTime($validated['shift_start_time_min'] ?? null);
        $pref->shift_start_time_max = $this->parseTime($validated['shift_start_time_max'] ?? null);
        $pref->willing_double_am_pm = (bool) ($validated['willing_double_am_pm'] ?? false);
        $pref->willing_double_pm_midnight = (bool) ($validated['willing_double_pm_midnight'] ?? false);
        $pref->willing_double_midnight_am = (bool) ($validated['willing_double_midnight_am'] ?? false);
        $pref->double_gap_minutes_acceptable = isset($validated['double_gap_minutes_acceptable']) ? (int) $validated['double_gap_minutes_acceptable'] : null;
        $pref->max_doubles_in_row = isset($validated['max_doubles_in_row']) ? (int) $validated['max_doubles_in_row'] : null;
        $pref->hide_posts_that_would_be_double = (bool) ($validated['hide_posts_that_would_be_double'] ?? false);
        $pref->save();

        return redirect()->route('preferences.edit')->with('status', 'Preferences updated.');
    }

    private function parseTime(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $parts = explode(':', $value);
        if (count($parts) >= 2 && is_numeric($parts[0]) && is_numeric($parts[1])) {
            $h = (int) $parts[0];
            $m = (int) $parts[1];
            if ($h >= 0 && $h <= 23 && $m >= 0 && $m <= 59) {
                return sprintf('%02d:%02d:00', $h, $m);
            }
        }

        return null;
    }
}
