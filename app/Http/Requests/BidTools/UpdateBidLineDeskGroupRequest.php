<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBidLineDeskGroupRequest extends FormRequest
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
            'desk_group' => ['required', 'string', 'max:64'],
        ];
    }
}
