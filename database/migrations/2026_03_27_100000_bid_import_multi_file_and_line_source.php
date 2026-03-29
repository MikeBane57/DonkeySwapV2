<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_imports', function (Blueprint $table) {
            $table->string('title', 160)->nullable()->after('original_filename');
        });

        Schema::table('bid_lines', function (Blueprint $table) {
            $table->string('source_label', 120)->nullable()->after('desk_group');
        });

        Schema::table('bid_lines', function (Blueprint $table) {
            $table->dropUnique(['bid_import_id', 'line_num']);
        });

        Schema::table('bid_lines', function (Blueprint $table) {
            $table->unique(['bid_import_id', 'line_num', 'desk_group']);
        });
    }

    public function down(): void
    {
        Schema::table('bid_lines', function (Blueprint $table) {
            $table->dropUnique(['bid_import_id', 'line_num', 'desk_group']);
        });

        Schema::table('bid_lines', function (Blueprint $table) {
            $table->unique(['bid_import_id', 'line_num']);
        });

        Schema::table('bid_lines', function (Blueprint $table) {
            $table->dropColumn('source_label');
        });

        Schema::table('bid_imports', function (Blueprint $table) {
            $table->dropColumn('title');
        });
    }
};
