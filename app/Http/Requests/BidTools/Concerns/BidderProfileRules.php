<?php

namespace App\Http\Requests\BidTools\Concerns;

use App\Services\BidTools\CondensedBidderProfileMapper;
use App\Services\BidTools\ScenarioScoreService;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            ...$this->flexibleHolidayRankRules("{$prefix}.holiday_rank", required: true),
            "{$prefix}.desk_rank" => ['required', 'array', 'min:1'],
            "{$prefix}.desk_rank.*.key" => [
                'required',
                'string',
                Rule::in(CondensedBidderProfileMapper::DESK_KEYS),
            ],
            "{$prefix}.desk_rank.*.priority" => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
            "{$prefix}.desk_rank.*.tier" => ['nullable', 'integer', 'min:1'],
            "{$prefix}.weights" => ['nullable', 'array'],
            "{$prefix}.weights.holiday" => ['nullable', 'numeric'],
            "{$prefix}.weights.personal" => ['nullable', 'numeric'],
            "{$prefix}.weights.desk" => ['nullable', 'numeric'],
            "{$prefix}.weights.vacation_penalty" => ['nullable', 'numeric'],
            "{$prefix}.weights.sort_mode" => ['nullable', 'string', Rule::in(ScenarioScoreService::SORT_MODES)],
            "{$prefix}.weights.criteria_order" => ['nullable', 'array'],
            "{$prefix}.weights.criteria_order.*" => ['string', Rule::in(['holiday', 'personal', 'desk'])],
            "{$prefix}.weights.start_time_tiebreak_order" => ['nullable', 'array'],
            "{$prefix}.weights.start_time_tiebreak_order.*" => ['string', Rule::in(ScenarioScoreService::START_TIME_TIEBREAK_KEYS)],
            "{$prefix}.personal_dates" => ['nullable', 'array'],
            "{$prefix}.personal_dates.*.date" => ['nullable', 'date_format:Y-m-d'],
            "{$prefix}.personal_dates.*.starts_on" => ['nullable', 'date_format:Y-m-d'],
            "{$prefix}.personal_dates.*.ends_on" => ['nullable', 'date_format:Y-m-d'],
            "{$prefix}.personal_dates.*.label" => ['nullable', 'string', 'max:120'],
            "{$prefix}.personal_dates.*.priority" => ['required', 'string', Rule::in(['ignore', 'low', 'high'])],
        ];
    }

    /**
     * Accept condensed holiday groups (key + priority) or full dated entries.
     *
     * @return array<string, mixed>
     */
    protected function flexibleHolidayRankRules(string $prefix, bool $required = false): array
    {
        $priorityRule = $required ? 'required' : "required_with:{$prefix}";

        return [
            $prefix => $required ? ['required', 'array', 'min:1'] : ['nullable', 'array'],
            "{$prefix}.*.date" => ['nullable', 'date_format:Y-m-d'],
            "{$prefix}.*.label" => ['nullable', 'string', 'max:120'],
            "{$prefix}.*.id" => ['nullable', 'string', 'max:64'],
            "{$prefix}.*.key" => [
                'nullable',
                'string',
                Rule::in(array_keys(CondensedBidderProfileMapper::HOLIDAY_GROUPS)),
            ],
            "{$prefix}.*.priority" => [$priorityRule, 'string', Rule::in(['ignore', 'low', 'high'])],
            "{$prefix}.*.tier" => ['nullable', 'integer', 'min:1'],
        ];
    }

    protected function validateFlexibleHolidayRank(Validator $validator, string $prefix): void
    {
        $validator->after(function (Validator $validator) use ($prefix): void {
            $entries = data_get($validator->getData(), $prefix);
            if (! is_array($entries)) {
                return;
            }

            foreach ($entries as $index => $entry) {
                if (! is_array($entry)) {
                    continue;
                }

                $hasDate = is_string($entry['date'] ?? null) && $entry['date'] !== '';
                $hasKey = is_string($entry['key'] ?? null) && $entry['key'] !== '';

                if (! $hasDate && ! $hasKey) {
                    $validator->errors()->add(
                        "{$prefix}.{$index}",
                        'Each holiday entry must include either a date or a condensed group key.',
                    );
                }
            }
        });
    }
}
