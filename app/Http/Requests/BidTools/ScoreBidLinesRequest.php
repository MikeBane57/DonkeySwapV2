<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;

class ScoreBidLinesRequest extends FormRequest
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
            'line_ids' => ['required', 'array', 'min:1', 'max:200'],
            'line_ids.*' => ['integer', 'exists:bid_lines,id'],
        ];
    }
}
