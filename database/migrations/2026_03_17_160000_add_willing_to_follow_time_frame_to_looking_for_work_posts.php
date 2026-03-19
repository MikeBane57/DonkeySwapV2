<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('looking_for_work_posts', function (Blueprint $table) {
            $table->string('willing_to_follow_time_frame', 20)->nullable()->after('willing_to_follow');
        });
    }

    public function down(): void
    {
        Schema::table('looking_for_work_posts', function (Blueprint $table) {
            $table->dropColumn('willing_to_follow_time_frame');
        });
    }
};
