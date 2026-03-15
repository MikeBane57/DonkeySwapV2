<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->json('desired_desk_types')->nullable()->after('max_doubles_in_row');
        });
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->dropColumn('undesired_desk_types');
        });
    }

    public function down(): void
    {
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->json('undesired_desk_types')->nullable()->after('max_doubles_in_row');
        });
        Schema::table('user_preferences', function (Blueprint $table) {
            $table->dropColumn('desired_desk_types');
        });
    }
};
