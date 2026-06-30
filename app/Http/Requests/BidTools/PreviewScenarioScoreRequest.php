<?php

namespace App\Http\Requests\BidTools;

use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PreviewScenarioScoreRequest extends FormRequest
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
            'line_ids' => ['required', 'array', 'min:1'],
            'line_ids.*' => ['integer'],
            'vacation_bank' => ['nullable', 'integer', 'min:0', 'max:255'],
            'weights' => ['nullable', 'array'],
            'weights.holiday' => ['nullable', 'numeric'],
            'weights.personal' => ['nullable', 'numeric'],
            'weights.start_time' => ['nullable', 'numeric'],
            'weights.desk' => ['nullable', 'numeric'],
            'weights.vacation_penalty' => ['nullable', 'numeric'],
            'weights.sort_mode' => ['nullable', 'string', Rule::in(ScenarioScoreService::SORT_MODES)],
            'weights.criteria_order' => ['nullable', 'array'],
            'weights.criteria_order.*' => ['string', Rule::in(['holiday', 'personal', 'start_time', 'desk'])],
            'weights.shift_order' => ['nullable', 'array'],
            'weights.shift_order.*' => ['string', Rule::in(['am', 'pm', 'mid'])],
            'holiday_rank' => ['nullable', 'array'],
            'holiday_rank.*.date' => ['required_with:holiday_rank', 'date_format:Y-m-d'],
            'holiday_rank.*.label' => ['nullable', 'string', 'max:120'],
            'holiday_rank.*.id' => ['nullable', 'string', 'max:64'],
            'holiday_rank.*.priority' => ['required_with:holiday_rank', 'string', Rule::in(['ignore', 'low', 'high'])],
            'desk_rank' => ['nullable', 'array'],
            'desk_rank.*.key' => ['required_with:desk_rank', 'string', 'max:64'],
            'desk_rank.*.priority' => ['required_with:desk_rank', 'string', Rule::in(['ignore', 'low', 'high'])],
            'desk_rank.*.tier' => ['nullable', 'integer', 'min:1'],
            'start_time_rank' => ['nullable', 'array'],
            'start_time_rank.*.key' => ['required_with:start_time_rank', 'string', 'max:120'],
            'start_time_rank.*.priority' => ['required_with:start_time_rank', 'string', Rule::in(['ignore', 'low', 'high'])],
            'start_time_rank.*.tier' => ['nullable', 'integer', 'min:1'],
            'personal_dates' => ['nullable', 'array'],
            'personal_dates.*.date' => ['required_with:personal_dates', 'date_format:Y-m-d'],
            'personal_dates.*.label' => ['nullable', 'string', 'max:120'],
            'personal_dates.*.priority' => ['required_with:personal_dates', 'string', Rule::in(['ignore', 'low', 'high'])],
        ];
    }
}
