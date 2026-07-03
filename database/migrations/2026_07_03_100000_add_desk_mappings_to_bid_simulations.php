<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_simulations', function (Blueprint $table) {
            $table->json('desk_bucket_mappings')->nullable()->after('name');
            $table->json('line_desk_buckets')->nullable()->after('desk_bucket_mappings');
        });
    }

    public function down(): void
    {
        Schema::table('bid_simulations', function (Blueprint $table) {
            $table->dropColumn(['desk_bucket_mappings', 'line_desk_buckets']);
        });
    }
};
