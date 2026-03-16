<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        $user = $this->route('user');
        $userId = $user instanceof \App\Models\User ? $user->id : (is_numeric($user) ? $user : 0);

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', 'unique:users,email,'.$userId],
            'role' => ['sometimes', 'string', 'in:worker,manager,admin'],
            'time_display_preference' => ['sometimes', 'string', 'in:central,central_zulu'],
            'phone' => ['nullable', 'string', 'max:50'],
            'preferred_contact_method' => ['nullable', 'string', 'in:email,call,text'],
            'workgroups' => ['array'],
            'workgroups.*.workgroup_id' => ['required', 'exists:workgroups,id'],
            'workgroups.*.classification_seniority_date' => ['nullable', 'date'],
            'workgroups.*.qualification_ids' => ['array'],
            'workgroups.*.qualification_ids.*' => ['integer', 'exists:workgroup_qualifications,id'],
        ];
    }
}
