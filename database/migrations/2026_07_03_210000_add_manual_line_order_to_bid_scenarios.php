<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_scenarios', function (Blueprint $table) {
            $table->json('manual_line_order')->nullable()->after('line_desk_buckets');
        });
    }

    public function down(): void
    {
        Schema::table('bid_scenarios', function (Blueprint $table) {
            $table->dropColumn('manual_line_order');
        });
    }
};
