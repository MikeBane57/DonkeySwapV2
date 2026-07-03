<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $scenarioIds = DB::table('bid_simulation_participants')
            ->distinct()
            ->pluck('bid_scenario_id')
            ->filter()
            ->all();

        if ($scenarioIds === []) {
            return;
        }

        DB::table('bid_scenarios')
            ->whereIn('id', $scenarioIds)
            ->update([
                'desk_bucket_mappings' => json_encode([]),
                'line_desk_buckets' => json_encode([]),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Cannot restore cleared per-bidder mappings.
    }
};
