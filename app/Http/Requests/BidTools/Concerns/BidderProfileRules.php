<?php

namespace App\Http\Requests\BidTools\Concerns;

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
            "{$prefix}.weights" => ['nullable', 'array'],
            "{$prefix}.weights.holiday" => ['nullable', 'numeric'],
            "{$prefix}.weights.personal" => ['nullable', 'numeric'],
            "{$prefix}.weights.start_time" => ['nullable', 'numeric'],
            "{$prefix}.weights.desk" => ['nullable', 'numeric'],
            "{$prefix}.weights.vacation_penalty" => ['nullable', 'numeric'],
            "{$prefix}.weights.criteria_order" => ['nullable', 'array'],
            "{$prefix}.weights.criteria_order.*" => ['string', Rule::in(['holiday', 'personal', 'start_time', 'desk'])],
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
