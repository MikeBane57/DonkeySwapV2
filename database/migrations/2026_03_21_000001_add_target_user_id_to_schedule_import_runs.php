<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedule_import_runs', function (Blueprint $table) {
            $table->foreignId('target_user_id')->nullable()->after('created_by_user_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('schedule_import_runs', function (Blueprint $table) {
            $table->dropForeign(['target_user_id']);
        });
    }
};
