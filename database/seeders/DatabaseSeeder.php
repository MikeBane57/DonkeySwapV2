<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            WorkgroupSeeder::class,
            WorkgroupAllowedStartTimeSeeder::class,
            UserSeeder::class,
            ShiftSeeder::class,
        ]);
    }
}
