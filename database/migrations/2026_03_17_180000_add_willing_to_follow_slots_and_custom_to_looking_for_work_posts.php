<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('looking_for_work_posts', 'willing_to_follow_slots')) {
            Schema::table('looking_for_work_posts', function (Blueprint $table) {
                $table->json('willing_to_follow_slots')->nullable()->after('willing_to_follow_time_frame');
            });
        }

        if (! Schema::hasColumn('looking_for_work_posts', 'willing_to_follow_custom')) {
            Schema::table('looking_for_work_posts', function (Blueprint $table) {
                $after = Schema::hasColumn('looking_for_work_posts', 'willing_to_follow_slots')
                    ? 'willing_to_follow_slots'
                    : 'willing_to_follow_time_frame';
                $table->text('willing_to_follow_custom')->nullable()->after($after);
            });
        }
    }

    public function down(): void
    {
        Schema::table('looking_for_work_posts', function (Blueprint $table) {
            if (Schema::hasColumn('looking_for_work_posts', 'willing_to_follow_custom')) {
                $table->dropColumn('willing_to_follow_custom');
            }
            if (Schema::hasColumn('looking_for_work_posts', 'willing_to_follow_slots')) {
                $table->dropColumn('willing_to_follow_slots');
            }
        });
    }
};
