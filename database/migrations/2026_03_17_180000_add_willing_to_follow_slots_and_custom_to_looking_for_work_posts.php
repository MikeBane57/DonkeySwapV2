<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('looking_for_work_posts', function (Blueprint $table) {
            $table->json('willing_to_follow_slots')->nullable()->after('willing_to_follow_time_frame');
            $table->text('willing_to_follow_custom')->nullable()->after('willing_to_follow_slots');
        });
    }

    public function down(): void
    {
        Schema::table('looking_for_work_posts', function (Blueprint $table) {
            $table->dropColumn(['willing_to_follow_slots', 'willing_to_follow_custom']);
        });
    }
};
