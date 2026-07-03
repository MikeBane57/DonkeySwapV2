<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_simulation_participants', function (Blueprint $table) {
            $table->boolean('skips_bid')->default(false)->after('display_name');
        });
    }

    public function down(): void
    {
        Schema::table('bid_simulation_participants', function (Blueprint $table) {
            $table->dropColumn('skips_bid');
        });
    }
};
