<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class DestroyUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            /** @var User $target */
            $target = $this->route('user');
            $actor = $this->user();
            if (! $actor) {
                return;
            }
            if ($target->id === $actor->id) {
                $validator->errors()->add('user', 'You cannot delete your own account.');
            }
            if ($target->role === 'admin') {
                $otherAdmins = User::where('role', 'admin')->where('id', '!=', $target->id)->exists();
                if (! $otherAdmins) {
                    $validator->errors()->add('user', 'Cannot delete the only remaining admin.');
                }
            }
        });
    }
}
