<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreBidLineImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'bid_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'batch_title' => ['nullable', 'string', 'max:160'],
            'files' => ['required', 'array', 'min:1', 'max:25'],
            'files.*' => ['file', 'mimes:csv,txt', 'max:51200'],
            'titles' => ['required', 'array'],
            'titles.*' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $files = $this->file('files', []);
            if (! is_array($files)) {
                $files = array_filter([$files]);
            }
            $titles = $this->input('titles', []);
            if (! is_array($titles)) {
                $titles = [];
            }
            if (count($files) !== count($titles)) {
                $v->errors()->add(
                    'files',
                    'Each CSV needs a workgroup label (same number of files and titles).'
                );
            }
        });
    }
}
