<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreRedLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'workgroup_id' => ['required', 'exists:workgroups,id'],
            'red_line_position' => ['required', 'integer', 'min:0'],
        ];
    }
}
