<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->boolean('allow_counter_offers')->default(false)->after('payback_date_ranges');
        });
    }

    public function down(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->dropColumn('allow_counter_offers');
        });
    }
};
