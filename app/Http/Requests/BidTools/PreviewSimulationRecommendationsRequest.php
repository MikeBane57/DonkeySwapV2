<?php

namespace App\Http\Requests\BidTools;

use App\Http\Requests\BidTools\Concerns\BidderProfileRules;
use Illuminate\Foundation\Http\FormRequest;

class PreviewSimulationRecommendationsRequest extends FormRequest
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
        return $this->bidderProfileRules();
    }
}
