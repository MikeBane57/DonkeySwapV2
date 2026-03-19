<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->json('payback_date_ranges')->nullable()->after('preferred_desk_type');
        });
    }

    public function down(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->dropColumn('payback_date_ranges');
        });
    }
};
