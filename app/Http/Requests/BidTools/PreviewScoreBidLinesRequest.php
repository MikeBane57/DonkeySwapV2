<?php

namespace App\Http\Requests\BidTools;

use App\Http\Requests\BidTools\Concerns\BidderProfileRules;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PreviewScoreBidLinesRequest extends FormRequest
{
    use BidderProfileRules;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return array_merge([
            'line_ids' => ['required', 'array', 'min:1', 'max:200'],
            'line_ids.*' => ['integer', 'exists:bid_lines,id'],
            'draft' => ['nullable', 'array'],
            'draft.vacation_bank' => ['nullable', 'integer', 'min:0', 'max:255'],
            'draft.weights' => ['nullable', 'array'],
            'draft.weights.holiday' => ['nullable', 'numeric'],
            'draft.weights.personal' => ['nullable', 'numeric'],
            'draft.weights.desk' => ['nullable', 'numeric'],
            'draft.weights.vacation_penalty' => ['nullable', 'numeric'],
            'draft.weights.sort_mode' => ['nullable', 'string', Rule::in(ScenarioScoreService::SORT_MODES)],
            'draft.weights.criteria_order' => ['nullable', 'array'],
            'draft.weights.criteria_order.*' => ['string', Rule::in(['holiday', 'personal', 'desk'])],
            'draft.weights.start_time_tiebreak_order' => ['nullable', 'array'],
            'draft.weights.start_time_tiebreak_order.*' => ['string', Rule::in(ScenarioScoreService::START_TIME_TIEBREAK_KEYS)],
        ], $this->flexibleHolidayRankRules('draft.holiday_rank'), [
            'draft.desk_rank' => ['nullable', 'array'],
            'draft.desk_rank.*.key' => ['required_with:draft.desk_rank', 'string', 'max:64'],
            'draft.desk_rank.*.priority' => ['required_with:draft.desk_rank', 'string', Rule::in(['ignore', 'low', 'high'])],
            'draft.desk_rank.*.tier' => ['nullable', 'integer', 'min:1'],
            'draft.personal_dates' => ['nullable', 'array'],
            'draft.personal_dates.*.date' => ['nullable', 'date_format:Y-m-d'],
            'draft.personal_dates.*.starts_on' => ['nullable', 'date_format:Y-m-d'],
            'draft.personal_dates.*.ends_on' => ['nullable', 'date_format:Y-m-d'],
            'draft.personal_dates.*.label' => ['nullable', 'string', 'max:120'],
            'draft.personal_dates.*.priority' => ['required_with:draft.personal_dates', 'string', Rule::in(['ignore', 'low', 'high'])],
            'draft.desk_bucket_mappings' => ['nullable', 'array'],
            'draft.desk_bucket_mappings.*.desk_group' => ['required_with:draft.desk_bucket_mappings', 'string', 'max:64'],
            'draft.desk_bucket_mappings.*.start_time' => ['nullable', 'string', 'max:64'],
            'draft.desk_bucket_mappings.*.bucket' => ['required_with:draft.desk_bucket_mappings', 'string', 'max:64'],
            'draft.line_desk_buckets' => ['nullable', 'array'],
            'draft.line_desk_buckets.*.bid_line_id' => ['required_with:draft.line_desk_buckets', 'integer'],
            'draft.line_desk_buckets.*.bucket' => ['required_with:draft.line_desk_buckets', 'string', 'max:64'],
        ]);
    }

    public function withValidator(Validator $validator): void
    {
        $this->validateFlexibleHolidayRank($validator, 'draft.holiday_rank');
    }
}
