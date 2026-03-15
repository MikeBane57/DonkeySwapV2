<?php

namespace Database\Factories;

use App\Models\Workgroup;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkgroupFactory extends Factory
{
    protected $model = Workgroup::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'regulatory' => false,
            'max_hours_per_day' => 10,
            'rest_required_hours' => 8,
            'allow_double' => false,
        ];
    }

    public function regulatory(): static
    {
        return $this->state(fn (array $attributes) => ['regulatory' => true]);
    }
}
