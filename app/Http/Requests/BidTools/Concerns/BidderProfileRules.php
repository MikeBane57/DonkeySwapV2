<?php

namespace App\Http\Requests\BidTools\Concerns;

use App\Services\BidTools\CondensedBidderProfileMapper;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Validation\Rule;

trait BidderProfileRules
{
    /**
     * @return array<string, mixed>
     */
    protected function bidderProfileRules(string $prefix = 'profile'): array
    {
        return [
            "{$prefix}" => ['required', 'array'],
            "{$prefix}.vacation_bank" => ['required', 'integer', 'min:0', 'max:255'],
            "{$prefix}.holiday_rank" => ['required', 'array', 'min:1'],
            "{$prefix}.holiday_rank.*.key" => [
                'required',
                'string',
                Rule::in(array_keys(CondensedBidderProfileMapper::HOLIDAY_GROUPS)),
            ],
            "{$prefix}.holiday_rank.*.priority" => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            "{$prefix}.holiday_rank.*.tier" => ['nullable', 'integer', 'min:1'],
            "{$prefix}.desk_rank" => ['required', 'array', 'min:1'],
            "{$prefix}.desk_rank.*.key" => [
                'required',
                'string',
                Rule::in(CondensedBidderProfileMapper::DESK_KEYS),
            ],
            "{$prefix}.desk_rank.*.priority" => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            "{$prefix}.desk_rank.*.tier" => ['nullable', 'integer', 'min:1'],
            "{$prefix}.start_time_rank" => ['required', 'array', 'min:1'],
            "{$prefix}.start_time_rank.*.key" => [
                'required',
                'string',
                Rule::in(CondensedBidderProfileMapper::START_TIME_KEYS),
            ],
            "{$prefix}.start_time_rank.*.priority" => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            "{$prefix}.start_time_rank.*.tier" => ['nullable', 'integer', 'min:1'],
            "{$prefix}.weights" => ['nullable', 'array'],
            "{$prefix}.weights.holiday" => ['nullable', 'numeric'],
            "{$prefix}.weights.personal" => ['nullable', 'numeric'],
            "{$prefix}.weights.start_time" => ['nullable', 'numeric'],
            "{$prefix}.weights.desk" => ['nullable', 'numeric'],
            "{$prefix}.weights.vacation_penalty" => ['nullable', 'numeric'],
            "{$prefix}.weights.sort_mode" => ['nullable', 'string', Rule::in(ScenarioScoreService::SORT_MODES)],
            "{$prefix}.weights.strict_shift_order" => ['nullable', 'boolean'],
            "{$prefix}.weights.criteria_order" => ['nullable', 'array'],
            "{$prefix}.weights.criteria_order.*" => ['string', Rule::in(['holiday', 'personal', 'start_time', 'desk'])],
            "{$prefix}.weights.shift_order" => ['nullable', 'array'],
            "{$prefix}.weights.shift_order.*" => ['string', Rule::in(['am', 'pm', 'mid'])],
            "{$prefix}.personal_dates" => ['nullable', 'array'],
            "{$prefix}.personal_dates.*.date" => ['required', 'date_format:Y-m-d'],
            "{$prefix}.personal_dates.*.label" => ['nullable', 'string', 'max:120'],
            "{$prefix}.personal_dates.*.priority" => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            "{$prefix}.vacation_ranges" => ['nullable', 'array'],
            "{$prefix}.vacation_ranges.*.starts_on" => ['required', 'date_format:Y-m-d'],
            "{$prefix}.vacation_ranges.*.ends_on" => ['required', 'date_format:Y-m-d'],
            "{$prefix}.vacation_ranges.*.title" => ['nullable', 'string', 'max:120'],
        ];
    }
}
