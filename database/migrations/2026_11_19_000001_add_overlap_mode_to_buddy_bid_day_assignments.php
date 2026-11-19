<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('buddy_bid_day_assignments')) {
            return;
        }

        if (! Schema::hasColumn('buddy_bid_day_assignments', 'overlap_mode')) {
            Schema::table('buddy_bid_day_assignments', function (Blueprint $table) {
                $table->string('overlap_mode', 16)->nullable()->after('double_participant_id');
            });
        }

        DB::table('buddy_bid_day_assignments')
            ->whereNotNull('double_participant_id')
            ->whereNull('overlap_mode')
            ->update(['overlap_mode' => 'double']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('buddy_bid_day_assignments')) {
            return;
        }

        if (Schema::hasColumn('buddy_bid_day_assignments', 'overlap_mode')) {
            Schema::table('buddy_bid_day_assignments', function (Blueprint $table) {
                $table->dropColumn('overlap_mode');
            });
        }
    }
};
