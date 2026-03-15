<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_banner_messages', function (Blueprint $table) {
            $table->dateTime('active_at_start')->nullable()->after('created_by');
            $table->dateTime('active_at_end')->nullable()->after('active_at_start');
        });
    }

    public function down(): void
    {
        Schema::table('admin_banner_messages', function (Blueprint $table) {
            $table->dropColumn(['active_at_start', 'active_at_end']);
        });
    }
};
