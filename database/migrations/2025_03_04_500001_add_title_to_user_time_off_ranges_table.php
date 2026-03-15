<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_time_off_ranges', function (Blueprint $table) {
            $table->string('title', 255)->nullable()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('user_time_off_ranges', function (Blueprint $table) {
            $table->dropColumn('title');
        });
    }
};
