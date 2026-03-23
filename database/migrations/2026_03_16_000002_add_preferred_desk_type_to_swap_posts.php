<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->string('preferred_desk_type', 64)->nullable()->after('preferred_start_times');
        });
    }

    public function down(): void
    {
        Schema::table('swap_posts', function (Blueprint $table) {
            $table->dropColumn('preferred_desk_type');
        });
    }
};
