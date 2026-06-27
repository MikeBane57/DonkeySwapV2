<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;

class CompareScenariosRequest extends FormRequest
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
            'scenario_a_id' => ['required', 'integer', 'different:scenario_b_id'],
            'scenario_b_id' => ['required', 'integer', 'different:scenario_a_id'],
            'line_ids' => ['required', 'array', 'min:1', 'max:200'],
            'line_ids.*' => ['integer', 'exists:bid_lines,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'scenario_a_id.different' => 'Choose two different scenarios.',
            'scenario_b_id.different' => 'Choose two different scenarios.',
        ];
    }
}
