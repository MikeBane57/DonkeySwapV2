<?php

namespace App\Concerns;

use App\Models\User;
use Illuminate\Validation\Rule;

trait ProfileValidationRules
{
    /**
     * Get the validation rules used to validate user profiles.
     *
     * @param  array<string, mixed>|null  $input  When calling from a context that has no request (e.g. CreateNewUser), pass the input array.
     * @return array<string, array<int, \Illuminate\Contracts\Validation\Rule|array<mixed>|string>>
     */
    protected function profileRules(?int $userId = null, ?array $input = null): array
    {
        $resolvedInput = $input ?? (method_exists($this, 'input') ? $this->input() : []);

        return [
            'name' => $this->nameRules(),
            'email' => $this->emailRules($userId),
            'phone' => [
                \Illuminate\Validation\Rule::requiredIf(fn () => in_array($resolvedInput['preferred_contact_method'] ?? null, ['call', 'text'], true)),
                'nullable',
                'string',
                'max:50',
            ],
            'preferred_contact_method' => ['required', 'string', 'in:call,text,email'],
        ];
    }

    /**
     * Get the validation rules used to validate user names.
     *
     * @return array<int, \Illuminate\Contracts\Validation\Rule|array<mixed>|string>
     */
    protected function nameRules(): array
    {
        return ['required', 'string', 'max:255'];
    }

    /**
     * Get the validation rules used to validate user emails.
     *
     * @return array<int, \Illuminate\Contracts\Validation\Rule|array<mixed>|string>
     */
    protected function emailRules(?int $userId = null): array
    {
        return [
            'required',
            'string',
            'email',
            'max:255',
            $userId === null
                ? Rule::unique(User::class)
                : Rule::unique(User::class)->ignore($userId),
        ];
    }
}
