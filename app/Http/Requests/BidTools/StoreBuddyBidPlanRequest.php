<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;

class StoreBuddyBidPlanRequest extends FormRequest
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
            'bid_import_id' => ['required', 'integer', 'exists:bid_imports,id'],
            'name' => ['required', 'string', 'max:120'],
        ];
    }
}
