<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('compliance_audit_logs')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE compliance_audit_logs MODIFY rule_violated TEXT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('compliance_audit_logs')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            // Truncate risk if rows exceed 255 chars; prefer not to shrink in production.
            DB::statement('ALTER TABLE compliance_audit_logs MODIFY rule_violated VARCHAR(255) NULL');
        }
    }
};
