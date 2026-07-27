<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompareBuddyBidSnapshotsRequest extends FormRequest
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
        $planId = (int) $this->route('buddyBid');

        return [
            'include_current' => ['sometimes', 'boolean'],
            'snapshot_ids' => ['present', 'array'],
            'snapshot_ids.*' => [
                'integer',
                Rule::exists('buddy_bid_plan_snapshots', 'id')
                    ->where('buddy_bid_plan_id', $planId),
            ],
        ];
    }
}
