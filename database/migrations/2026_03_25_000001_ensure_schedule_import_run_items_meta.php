<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Safety net if a prior migration was marked run without adding `meta` (e.g. host quirk).
     */
    public function up(): void
    {
        if (! Schema::hasTable('schedule_import_run_items')) {
            return;
        }
        if (Schema::hasColumn('schedule_import_run_items', 'meta')) {
            return;
        }
        Schema::table('schedule_import_run_items', function (Blueprint $table) {
            $table->json('meta')->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('schedule_import_run_items') || ! Schema::hasColumn('schedule_import_run_items', 'meta')) {
            return;
        }
        Schema::table('schedule_import_run_items', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
    }
};
