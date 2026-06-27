<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        if (! Schema::hasTable('sessions') || ! Schema::hasColumn('sessions', 'payload')) {
            return;
        }

        DB::statement('ALTER TABLE `sessions` MODIFY `payload` LONGTEXT NOT NULL');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        if (! Schema::hasTable('sessions') || ! Schema::hasColumn('sessions', 'payload')) {
            return;
        }

        DB::statement('ALTER TABLE `sessions` MODIFY `payload` TEXT NOT NULL');
    }
};
