<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBidSimulationRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'desk_bucket_mappings' => ['nullable', 'array'],
            'desk_bucket_mappings.*.desk_group' => ['required', 'string', 'max:64'],
            'desk_bucket_mappings.*.start_time' => ['nullable', 'string', 'max:64'],
            'desk_bucket_mappings.*.bucket' => ['required', 'string', 'max:64'],
            'line_desk_buckets' => ['nullable', 'array'],
            'line_desk_buckets.*.bid_line_id' => ['required', 'integer'],
            'line_desk_buckets.*.bucket' => ['required', 'string', 'max:64'],
        ];
    }
}
