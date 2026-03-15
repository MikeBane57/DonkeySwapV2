<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_workgroups', function (Blueprint $table) {
            $table->unsignedInteger('red_line_seniority_number')->nullable()->after('classification_seniority_date');
        });
    }

    public function down(): void
    {
        Schema::table('user_workgroups', function (Blueprint $table) {
            $table->dropColumn('red_line_seniority_number');
        });
    }
};
