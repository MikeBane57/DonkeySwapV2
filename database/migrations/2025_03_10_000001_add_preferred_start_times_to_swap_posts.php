<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->json('preferred_start_times')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->dropColumn('preferred_start_times');
        });
    }
};
