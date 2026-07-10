<?php

namespace App\Http\Requests\BidTools;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBuddyBidAssignmentsRequest extends FormRequest
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
            'assignments' => ['required', 'array'],
            'assignments.*.date' => ['required', 'date'],
            'assignments.*.double_participant_id' => [
                'nullable',
                'integer',
                Rule::exists('buddy_bid_participants', 'id')->where(
                    'buddy_bid_plan_id',
                    $planId,
                ),
            ],
        ];
    }
}
