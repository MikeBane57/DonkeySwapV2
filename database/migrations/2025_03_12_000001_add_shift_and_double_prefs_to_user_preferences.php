<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->time('shift_start_time_min')->nullable()->after('preferred_shift_type');
            $table->time('shift_start_time_max')->nullable()->after('shift_start_time_min');
            $table->unsignedSmallInteger('double_gap_minutes_acceptable')->nullable()->after('willing_double_midnight_am');
            $table->unsignedTinyInteger('max_doubles_in_row')->nullable()->after('double_gap_minutes_acceptable');
        });
    }

    public function down(): void
    {
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->dropColumn([
                'shift_start_time_min',
                'shift_start_time_max',
                'double_gap_minutes_acceptable',
                'max_doubles_in_row',
            ]);
        });
    }
};
