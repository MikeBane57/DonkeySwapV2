<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workgroups', function (Blueprint $table) {
            $table->dropColumn('regulatory');
        });
    }

    public function down(): void
    {
        Schema::table('workgroups', function (Blueprint $table) {
            $table->boolean('regulatory')->default(false)->after('name');
        });
    }
};
