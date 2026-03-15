<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRedLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'red_line_position' => ['required', 'integer', 'min:0'],
            'above_line_seniority' => ['array'],
            'above_line_seniority.*.user_id' => ['required', 'integer', 'exists:users,id'],
            'above_line_seniority.*.seniority_number' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
