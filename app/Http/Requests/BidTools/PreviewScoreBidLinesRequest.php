<?php

namespace App\Http\Requests\BidTools;

use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PreviewScoreBidLinesRequest extends FormRequest
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
            'draft' => ['nullable', 'array'],
            'draft.vacation_bank' => ['nullable', 'integer', 'min:0', 'max:255'],
            'draft.weights' => ['nullable', 'array'],
            'draft.weights.holiday' => ['nullable', 'numeric'],
            'draft.weights.personal' => ['nullable', 'numeric'],
            'draft.weights.start_time' => ['nullable', 'numeric'],
            'draft.weights.desk' => ['nullable', 'numeric'],
            'draft.weights.vacation_penalty' => ['nullable', 'numeric'],
            'draft.weights.sort_mode' => ['nullable', 'string', Rule::in(ScenarioScoreService::SORT_MODES)],
            'draft.weights.criteria_order' => ['nullable', 'array'],
            'draft.weights.criteria_order.*' => ['string', Rule::in(['holiday', 'personal', 'start_time', 'desk'])],
            'draft.weights.strict_shift_order' => ['nullable', 'boolean'],
            'draft.weights.shift_order' => ['nullable', 'array'],
            'draft.weights.shift_order.*' => ['string', Rule::in(['am', 'pm', 'mid'])],
            'draft.holiday_rank' => ['nullable', 'array'],
            'draft.holiday_rank.*.date' => ['required_with:draft.holiday_rank', 'date_format:Y-m-d'],
            'draft.holiday_rank.*.label' => ['nullable', 'string', 'max:120'],
            'draft.holiday_rank.*.id' => ['nullable', 'string', 'max:64'],
            'draft.holiday_rank.*.key' => ['nullable', 'string', 'max:64'],
            'draft.holiday_rank.*.priority' => ['required_with:draft.holiday_rank', 'string', Rule::in(['ignore', 'low', 'high'])],
            'draft.holiday_rank.*.tier' => ['nullable', 'integer', 'min:1'],
            'draft.desk_rank' => ['nullable', 'array'],
            'draft.desk_rank.*.key' => ['required_with:draft.desk_rank', 'string', 'max:64'],
            'draft.desk_rank.*.priority' => ['required_with:draft.desk_rank', 'string', Rule::in(['ignore', 'low', 'high'])],
            'draft.desk_rank.*.tier' => ['nullable', 'integer', 'min:1'],
            'draft.start_time_rank' => ['nullable', 'array'],
            'draft.start_time_rank.*.key' => ['required_with:draft.start_time_rank', 'string', 'max:120'],
            'draft.start_time_rank.*.priority' => ['required_with:draft.start_time_rank', 'string', Rule::in(['ignore', 'low', 'high'])],
            'draft.start_time_rank.*.tier' => ['nullable', 'integer', 'min:1'],
            'draft.personal_dates' => ['nullable', 'array'],
            'draft.personal_dates.*.date' => ['required_with:draft.personal_dates', 'date_format:Y-m-d'],
            'draft.personal_dates.*.label' => ['nullable', 'string', 'max:120'],
            'draft.personal_dates.*.priority' => ['required_with:draft.personal_dates', 'string', Rule::in(['ignore', 'low', 'high'])],
            'draft.vacation_ranges' => ['nullable', 'array'],
            'draft.vacation_ranges.*.starts_on' => ['required_with:draft.vacation_ranges', 'date_format:Y-m-d'],
            'draft.vacation_ranges.*.ends_on' => ['required_with:draft.vacation_ranges', 'date_format:Y-m-d'],
            'draft.vacation_ranges.*.title' => ['nullable', 'string', 'max:120'],
        ];
    }
}
