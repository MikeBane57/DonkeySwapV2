<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreWorkgroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'regulatory' => ['boolean'],
            'max_hours_per_day' => ['nullable', 'integer', 'min:1', 'max:24'],
            'rest_required_hours' => ['nullable', 'integer', 'min:0', 'max:24'],
            'allow_double' => ['boolean'],
            'allowed_start_times' => ['array'],
            'allowed_start_times.*.start_time' => ['required', 'string', 'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/'],
            'allowed_start_times.*.default_duration_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'desk_types' => ['array'],
            'desk_types.*.code' => ['required', 'string', 'max:64'],
            'desk_types.*.label' => ['required', 'string', 'max:100'],
            'desk_types.*.workgroup_qualification_code' => ['nullable', 'string', 'max:30'],
            'position_ranges' => ['array'],
            'position_ranges.*.range_spec' => ['required', 'string', 'max:100'],
            'position_ranges.*.parity' => ['nullable', 'string', 'in:even,odd'],
            'position_ranges.*.desk_type_code' => ['nullable', 'string', 'max:64'],
            'qualifications' => ['array'],
            'qualifications.*.code' => ['required', 'string', 'max:30'],
            'qualifications.*.label' => ['required', 'string', 'max:100'],
        ];
    }
}
