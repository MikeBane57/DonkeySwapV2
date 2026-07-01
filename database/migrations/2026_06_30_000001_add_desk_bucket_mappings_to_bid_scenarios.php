<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_scenarios', function (Blueprint $table) {
            $table->json('desk_bucket_mappings')->nullable()->after('code_overrides');
        });
    }

    public function down(): void
    {
        Schema::table('bid_scenarios', function (Blueprint $table) {
            $table->dropColumn('desk_bucket_mappings');
        });
    }
};
