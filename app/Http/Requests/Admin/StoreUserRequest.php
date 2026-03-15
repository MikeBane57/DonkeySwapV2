<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
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
}
