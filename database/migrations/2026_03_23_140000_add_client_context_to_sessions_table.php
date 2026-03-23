<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->string('client_display_mode', 32)->nullable()->after('user_agent');
            $table->string('client_platform', 64)->nullable()->after('client_display_mode');
        });
    }

    public function down(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->dropColumn(['client_display_mode', 'client_platform']);
        });
    }
};
