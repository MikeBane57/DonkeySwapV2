<?php

namespace App\Http\Requests\BidTools;

use App\Models\BuddyBidPlan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBuddyBidParticipantsRequest extends FormRequest
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
            'participants' => ['required', 'array', 'size:2'],
            'participants.*.id' => [
                'nullable',
                'integer',
                Rule::exists('buddy_bid_participants', 'id')->where(
                    'buddy_bid_plan_id',
                    $planId,
                ),
            ],
            'participants.*.display_name' => ['required', 'string', 'max:120'],
            'participants.*.bid_line_id' => [
                'required',
                'integer',
                Rule::exists('bid_lines', 'id')->where(
                    'bid_import_id',
                    BuddyBidPlan::query()->whereKey($planId)->value('bid_import_id'),
                ),
            ],
            'participants.*.profile.vacation_dates' => ['nullable', 'array'],
            'participants.*.profile.vacation_dates.*' => ['date'],
            'participants.*.profile.pull_dates' => ['nullable', 'array'],
            'participants.*.profile.pull_dates.*' => ['date'],
        ];
    }
}
