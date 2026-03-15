<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->unsignedInteger('view_count')->default(0)->after('status');
            $table->unsignedInteger('click_count')->default(0)->after('view_count');
        });

        Schema::table('swap_offers', function (Blueprint $table) {
            $table->text('response_notes')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->dropColumn(['view_count', 'click_count']);
        });
        Schema::table('swap_offers', function (Blueprint $table) {
            $table->dropColumn('response_notes');
        });
    }
};
