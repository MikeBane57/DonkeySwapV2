<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'scenario_ids' => ['required', 'array', 'min:2', 'max:8'],
            'scenario_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('bid_scenarios', 'id')->where(fn ($q) => $q->where('user_id', $this->user()->id)),
            ],
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
            'scenario_ids.min' => 'Select at least two scenarios to compare.',
            'scenario_ids.max' => 'You can compare up to eight scenarios at once.',
            'scenario_ids.*.distinct' => 'Each scenario can only be selected once.',
        ];
    }
}
