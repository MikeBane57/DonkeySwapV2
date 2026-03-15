<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_offers', function (Blueprint $table) {
            $table->json('offered_shift_preference_order')->nullable()->after('offered_shift_id');
        });
    }

    public function down(): void
    {
        Schema::table('swap_offers', function (Blueprint $table) {
            $table->dropColumn('offered_shift_preference_order');
        });
    }
};
