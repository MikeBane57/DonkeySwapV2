<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBidScenarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'bid_import_id' => [
                'required',
                'integer',
                Rule::exists('bid_imports', 'id')->where('is_current', true),
            ],
            'name' => ['required', 'string', 'max:120'],
        ];
    }
}
