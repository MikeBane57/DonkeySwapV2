<?php

namespace App\Http\Requests\BidTools;

use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBidScenarioRequest extends FormRequest
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
            'vacation_bank' => ['required', 'integer', 'min:0', 'max:255'],
            'weights' => ['nullable', 'array'],
            'weights.holiday' => ['nullable', 'numeric'],
            'weights.personal' => ['nullable', 'numeric'],
            'weights.start_time' => ['nullable', 'numeric'],
            'weights.desk' => ['nullable', 'numeric'],
            'weights.vacation_penalty' => ['nullable', 'numeric'],
            'weights.sort_mode' => ['nullable', 'string', Rule::in(ScenarioScoreService::SORT_MODES)],
            'weights.criteria_order' => ['nullable', 'array'],
            'weights.criteria_order.*' => ['string', Rule::in(['holiday', 'personal', 'start_time', 'desk'])],
            'holiday_rank' => ['required', 'array'],
            'holiday_rank.*.date' => ['required', 'date_format:Y-m-d'],
            'holiday_rank.*.label' => ['nullable', 'string', 'max:120'],
            'holiday_rank.*.id' => ['nullable', 'string', 'max:64'],
            'holiday_rank.*.priority' => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            'desk_rank' => ['nullable', 'array'],
            'desk_rank.*.key' => ['required', 'string', 'max:64'],
            'desk_rank.*.priority' => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            'start_time_rank' => ['nullable', 'array'],
            'start_time_rank.*.key' => ['required', 'string', 'max:120'],
            'start_time_rank.*.priority' => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            'personal_dates' => ['nullable', 'array'],
            'personal_dates.*.date' => ['required', 'date_format:Y-m-d'],
            'personal_dates.*.label' => ['nullable', 'string', 'max:120'],
            'personal_dates.*.priority' => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            'code_overrides' => ['nullable', 'array'],
            'vacation_ranges' => ['nullable', 'array'],
            'vacation_ranges.*.starts_on' => ['required', 'date_format:Y-m-d'],
            'vacation_ranges.*.ends_on' => ['required', 'date_format:Y-m-d'],
            'vacation_ranges.*.title' => ['nullable', 'string', 'max:120'],
        ];
    }
}
