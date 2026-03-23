<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('employee_id') === '') {
            $this->merge(['employee_id' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'employee_id' => ['nullable', 'string', 'max:30', 'unique:users,employee_id'],
            'role' => ['required', 'string', 'in:worker,manager,admin'],
            'time_display_preference' => ['required', 'string', 'in:central,central_zulu'],
            'phone' => ['nullable', 'string', 'max:50'],
            'preferred_contact_method' => ['nullable', 'string', 'in:email,call,text'],
            'workgroups' => ['array'],
            'workgroups.*.workgroup_id' => ['required', 'exists:workgroups,id'],
            'workgroups.*.classification_seniority_date' => ['nullable', 'date'],
            'workgroups.*.qualification_ids' => ['array'],
            'workgroups.*.qualification_ids.*' => ['integer', 'exists:workgroup_qualifications,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the user’s name.',
            'email.required' => 'Enter an email address.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'That email is already in use.',
            'employee_id.unique' => 'That employee ID is already assigned to another user.',
            'role.required' => 'Choose a role (worker, manager, or admin).',
            'role.in' => 'Role must be worker, manager, or admin.',
            'time_display_preference.required' => 'Choose a time display preference.',
            'time_display_preference.in' => 'Time display must be Central or Central + Zulu.',
            'workgroups.*.workgroup_id.required' => 'Each workgroup row must include a valid workgroup.',
            'workgroups.*.workgroup_id.exists' => 'One of the workgroups no longer exists. Refresh the page and try again.',
            'workgroups.*.qualification_ids.*.exists' => 'One of the selected qualifications is invalid for that workgroup.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'workgroups.*.workgroup_id' => 'workgroup',
            'workgroups.*.qualification_ids.*' => 'qualification',
        ];
    }
}
