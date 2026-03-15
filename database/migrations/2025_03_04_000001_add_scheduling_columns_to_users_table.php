<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('worker')->after('password'); // worker, manager, admin
            $table->date('dispatch_master_seniority_date')->nullable()->after('role');
            $table->string('time_display_preference')->default('central')->after('dispatch_master_seniority_date'); // central, central_zulu
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'dispatch_master_seniority_date', 'time_display_preference']);
        });
    }
};
