<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBidSimulationParticipantLineOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'line_order' => ['nullable', 'array'],
            'line_order.*' => ['integer', 'distinct'],
        ];
    }
}
