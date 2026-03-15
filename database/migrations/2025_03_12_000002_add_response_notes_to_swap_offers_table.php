<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_offers', function (Blueprint $table) {
            if (! Schema::hasColumn('swap_offers', 'response_notes')) {
                $table->text('response_notes')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('swap_offers', function (Blueprint $table) {
            $table->dropColumn('response_notes');
        });
    }
};
