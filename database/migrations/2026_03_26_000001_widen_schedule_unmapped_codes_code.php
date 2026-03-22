<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bad CSV rows can store long strings in `code`; MySQL VARCHAR(50) truncates and breaks merge import.
     */
    public function up(): void
    {
        if (! Schema::hasTable('schedule_unmapped_codes')) {
            return;
        }
        $conn = Schema::getConnection();
        if (! in_array($conn->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }
        $conn->statement('ALTER TABLE `schedule_unmapped_codes` MODIFY `code` VARCHAR(512) NOT NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('schedule_unmapped_codes')) {
            return;
        }
        $conn = Schema::getConnection();
        if (! in_array($conn->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }
        $conn->statement('ALTER TABLE `schedule_unmapped_codes` MODIFY `code` VARCHAR(50) NOT NULL');
    }
};
