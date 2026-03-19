<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_offers', function (Blueprint $table) {
            $table->decimal('counter_cash_amount', 10, 2)->nullable()->after('response_notes');
        });
    }

    public function down(): void
    {
        Schema::table('swap_offers', function (Blueprint $table) {
            $table->dropColumn('counter_cash_amount');
        });
    }
};
