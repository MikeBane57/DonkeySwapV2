<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ImportUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'csv_content' => ['nullable', 'string', 'max:5242880'],
            'file' => ['nullable', 'file', 'max:5120'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $hasFile = $this->hasFile('file') && $this->file('file')?->isValid();
            $paste = trim((string) $this->input('csv_content'));
            if (! $hasFile && $paste === '') {
                $validator->errors()->add('csv_content', 'Upload a CSV file or paste CSV content.');
            }
        });
    }
}
